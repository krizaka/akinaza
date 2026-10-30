import { associationApproved } from "@akinaza/db";
import { PaymentsError } from "@krizaka/payments";

import { systemClock } from "@/app/system-clock";
import { requireSession } from "@/lib/access";
import { audit } from "@/lib/audit";
import { customerOf, founderGate, recordOfferedVersion, trialEligible } from "@/lib/billing";
import { db, query } from "@/lib/db";
import { env } from "@/lib/env";
import { founderCap, onSale } from "@/lib/founder-offer";
import { handle, HttpError, refuse } from "@/lib/http";
import { checkoutWithTrial, isLiveMode, paymentsFrom, supportsTrial } from "@/lib/payments/config";
import { isPlanId, PLAN_KEY, type PlanId, planRefusal, trialDaysFor,TrialRefused } from "@/lib/plans";
import { appPrices } from "@/lib/price-catalogue";
import { PROCESSOR_PLANS } from "@/lib/pricing";
import { limit } from "@/lib/rate-limit";
import { TERMS_VERSION } from "@/lib/site";

export const dynamic = "force-dynamic";

type Entry = Awaited<ReturnType<ReturnType<typeof appPrices>["entry"]>>;

/** Who may buy the plan now: the founder offer while its seats last; the others while on sale, the Association plan once its proof is approved. */
async function guardPlan(plan: PlanId, entry: Entry, accountId: string): Promise<void> {
  if (plan === "founder") {
    if (!onSale(entry)) throw refuse(409, "FOUNDER_OFFER_FULL", "The founder offer is not on sale");
    // The first businesses only (the entry's `founderCap`): a founder is never turned away, a newcomer is once the offer is complete.
    if ((await founderGate(query, accountId, founderCap(entry))) === "full") throw refuse(409, "FOUNDER_OFFER_FULL", "The founder offer is complete");
    return;
  }
  const approved = plan === "association" && (await associationApproved(db(), accountId));
  const refusal = planRefusal(plan, entry, { associationApproved: approved });
  if (refusal === "ASSOCIATION_NOT_APPROVED") throw refuse(403, refusal, "The association has not been approved yet");
  if (refusal) throw refuse(409, refusal, "This plan is not on sale");
}

/** The free days of this checkout (once per account, never on a live key); an adapter that cannot carry them sells nothing rather than say « free » and charge. */
async function trialFor(entry: Entry, accountId: string, options: { liveMode: boolean; carriesTrial: boolean }): Promise<number> {
  let days: number;
  try {
    days = trialDaysFor(entry, { eligible: await trialEligible(query, accountId), liveMode: options.liveMode });
  } catch (error) {
    if (error instanceof TrialRefused) throw refuse(503, error.code, "The free trial is only available in test mode");
    throw error;
  }
  if (days > 0 && !options.carriesTrial) throw refuse(503, "TRIAL_NOT_READY", "The free trial is being set up");
  return days;
}

/**
 * A hosted payment page for the signed-in account, for the plan in `?plan=` (`founder` by default, `starter`, `scale`,
 * `association`). The amount is the catalogue's entry in force (akinaza#371) and the processor must sell exactly that amount, or
 * nothing is sold; GST and QST are the processor's. A plan with free days in its entry (`trialDays`) starts with them, once per
 * account and in the processor's test mode only; the Association plan needs an approved proof (ADR-003 addendum 2026-10-30).
 */
export function POST(req: Request) {
  return handle(async () => {
    const e = env();
    const port = paymentsFrom(e);
    if (!port) throw refuse(503, "PAYMENTS_OFF", "Payment is not available yet");
    const url = new URL(req.url);
    const redirect = url.searchParams.get("redirect") === "1";
    const locale = url.searchParams.get("locale") === "fr" ? "fr" : "en";
    const asked = url.searchParams.get("plan") ?? "founder";
    if (!isPlanId(asked)) throw refuse(400, "BAD_REQUEST", "Unknown plan");
    const plan: PlanId = asked;
    // A form on the public page: no session sends the visitor to sign in (a redirect), the API answers 401 as usual.
    const { account } = await requireSession(req).catch((error) => {
      if (redirect && error instanceof HttpError && error.status === 401) throw new HttpError(303, "Sign in first", { code: "UNAUTHENTICATED" }, { Location: `/${locale}/sign-in` });
      throw error;
    });
    limit("billing", req, account.id, [20, 3600]);
    const entry = await appPrices().entry(PLAN_KEY[plan], systemClock.now());
    await guardPlan(plan, entry, account.id);
    const trialDays = await trialFor(entry, account.id, { liveMode: isLiveMode(e), carriesTrial: supportsTrial(port) });
    const kind = PROCESSOR_PLANS[PLAN_KEY[plan]].kind;
    try {
      // The price shown is the price charged: a processor still on another amount (a change not yet set up there) sells nothing.
      if ((await port.price(kind)).amount !== entry.amountCents) throw refuse(503, "PRICE_NOT_READY", "The price is being updated");
      // The version sold is kept with the account: a founder keeps this price whatever is scheduled later.
      await recordOfferedVersion(query, account.id, entry.versionId);
      // The terms shown beside the button (the accepted version) are kept in the audit trail with the subscription being started.
      await audit({ action: "billing.terms_accepted", actorId: account.id, actorLabel: account.email, targetId: account.id, detail: { termsVersion: TERMS_VERSION, priceVersion: entry.versionId, plan, trialDays }, headers: req.headers });
      const customerId = await customerOf(query, account.id, () => port.createCustomer(account.email, account.id));
      const base = `${e.APP_PUBLIC_URL.replace(/\/$/, "")}/${account.locale}`;
      const session = await checkoutWithTrial(port, { kind, trialDays: trialDays || undefined, customerId, accountId: account.id, successUrl: `${base}/app?billing=success`, cancelUrl: `${base}?billing=cancelled`, locale: account.locale });
      return redirect ? new Response(null, { status: 303, headers: { Location: session.url } }) : Response.json({ url: session.url });
    } catch (error) {
      if (error instanceof PaymentsError) throw refuse(502, "PAYMENTS_UNAVAILABLE", "The payment page could not be opened");
      throw error;
    }
  });
}

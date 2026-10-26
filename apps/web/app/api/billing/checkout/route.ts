import { PaymentsError } from "@krizaka/payments";

import { systemClock } from "@/app/system-clock";
import { requireSession } from "@/lib/access";
import { customerOf, founderGate, recordOfferedVersion } from "@/lib/billing";
import { query } from "@/lib/db";
import { env } from "@/lib/env";
import { founderCap, onSale, starterEntry } from "@/lib/founder-offer";
import { handle, HttpError, refuse } from "@/lib/http";
import { paymentsFrom, STARTER_PLAN } from "@/lib/payments/config";
import { appPrices } from "@/lib/price-catalogue";
import { limit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * The founder offer (Starter): a hosted payment page for the signed-in account. The amount is the catalogue's entry in force
 * (akinaza#371) and the processor must sell exactly that amount, or nothing is sold; GST and QST are the processor's.
 */
export function POST(req: Request) {
  return handle(async () => {
    const e = env();
    const port = paymentsFrom(e);
    if (!port) throw refuse(503, "PAYMENTS_OFF", "Payment is not available yet");
    const url = new URL(req.url);
    const redirect = url.searchParams.get("redirect") === "1";
    const locale = url.searchParams.get("locale") === "fr" ? "fr" : "en";
    // A form on the public page: no session sends the visitor to sign in (a redirect), the API answers 401 as usual.
    const { account } = await requireSession(req).catch((error) => {
      if (redirect && error instanceof HttpError && error.status === 401) throw new HttpError(303, "Sign in first", { code: "UNAUTHENTICATED" }, { Location: `/${locale}/sign-in` });
      throw error;
    });
    limit("billing", req, account.id, [20, 3600]);
    const entry = await starterEntry(appPrices(), systemClock.now());
    if (!onSale(entry)) throw refuse(409, "FOUNDER_OFFER_FULL", "The founder offer is not on sale");
    // The first businesses only (the entry's `founderCap`): a founder is never turned away, a newcomer is once the offer is complete.
    if ((await founderGate(query, account.id, founderCap(entry))) === "full") throw refuse(409, "FOUNDER_OFFER_FULL", "The founder offer is complete");
    try {
      // The price shown is the price charged: a processor still on another amount (a change not yet set up there) sells nothing.
      if ((await port.price(STARTER_PLAN)).amount !== entry.amountCents) throw refuse(503, "PRICE_NOT_READY", "The price is being updated");
      // The version sold is kept with the account: a founder keeps this price whatever is scheduled later.
      await recordOfferedVersion(query, account.id, entry.versionId);
      const customerId = await customerOf(query, account.id, () => port.createCustomer(account.email, account.id));
      const base = `${e.APP_PUBLIC_URL.replace(/\/$/, "")}/${account.locale}`;
      const session = await port.checkout({ kind: STARTER_PLAN, customerId, accountId: account.id, successUrl: `${base}/app?billing=success`, cancelUrl: `${base}?billing=cancelled`, locale: account.locale });
      return redirect ? new Response(null, { status: 303, headers: { Location: session.url } }) : Response.json({ url: session.url });
    } catch (error) {
      if (error instanceof PaymentsError) throw refuse(502, "PAYMENTS_UNAVAILABLE", "The payment page could not be opened");
      throw error;
    }
  });
}

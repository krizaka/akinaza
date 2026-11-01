import { AVAILABILITY, type PublicPrice } from "@krizaka/settings";

import { trialDaysOf, trialMonthsOf } from "./plans";
import { centsText, priceText, rateText } from "./price-text";
import { ASSOCIATION, FOUNDER, SCALE, STARTER } from "./pricing";

/**
 * The public pricing page's plans, built from the catalogue's public view (akinaza#380): every price, rate and cap is read from the
 * entries and formatted with the visitor's locale, never typed in a message. A feature that is not built says « soon » and carries
 * no figure; the founder plan appears only while its offer is on sale.
 *
 * What runs (`soon: false`) is listed with a tick; what is planned (`soon: true`) is shown apart under « Soon », with no tick
 * (akinaza#440): the client payments and the terms that depend on them (the fees), the signed order contract, the B2B transfers.
 * The plan above Starter lists only what differs: « Everything in Starter », then its planned features.
 */
export type FeatureId = "inherits" | "booking" | "invoices" | "books" | "payments" | "fees" | "contract" | "transfers";

export interface PlanFeature {
  id: FeatureId;
  /** Not built yet: worded « soon », with no figure. */
  soon: boolean;
  /** The figures of the message (only a feature that is built has any). */
  vars: Record<string, string>;
}
export interface PlanView {
  id: "founder" | "starter" | "scale" | "association";
  /** The amount, or null while the entry is in preparation (no figure is guessed). */
  price: string | null;
  /** The founder plan: the first businesses, limited by the catalogue's `founderCap`. */
  limit: number | null;
  /** The free time at the start (the entry's `trialDays`): whole months when it is, for « 3 months free »; null when the plan has none. */
  trial: { days: number; months: number | null } | null;
  features: PlanFeature[];
}

const KEYS = { founder: FOUNDER, starter: STARTER, scale: SCALE, association: ASSOCIATION } as const;

const built = (id: FeatureId): PlanFeature => ({ id, soon: false, vars: {} });
const soon = (id: FeatureId): PlanFeature => ({ id, soon: true, vars: {} });

function featuresOf(plan: PlanView["id"], entry: PublicPrice, locale: "en" | "fr", inheritsStarter: boolean): PlanFeature[] {
  const limits = entry.limits;
  const fees: PlanFeature[] =
    limits.cardFeeBps !== undefined && limits.directDebitBps !== undefined && limits.directDebitCapCents !== undefined
      ? [{ id: "fees", soon: true, vars: { cardRate: rateText(limits.cardFeeBps, locale), debitRate: rateText(limits.directDebitBps, locale), debitCap: centsText(limits.directDebitCapCents, locale) } }]
      : [];
  const running = (plan === "scale" || plan === "association") && inheritsStarter ? [built("inherits")] : [built("booking"), built("invoices"), built("books")];
  return [...running, soon("payments"), ...fees, ...(plan === "scale" ? [soon("contract"), soon("transfers")] : [])];
}

/**
 * What the Subscription page sells: the very plans /pricing shows (the same `pricingPlans`, so the two never disagree), minus the
 * founder offer (it has its own row and its own seats) and minus a plan still in preparation (no figure, nothing to buy).
 */
export function subscriptionPlans(plans: readonly PlanView[]): { id: "starter" | "scale" | "association"; price: string; trial: { months: number | null; days: number } | null }[] {
  const sold: { id: "starter" | "scale" | "association"; price: string; trial: { months: number | null; days: number } | null }[] = [];
  for (const plan of plans) {
    if (plan.id === "founder" || plan.price === null) {continue;}
    sold.push({ id: plan.id, price: plan.price, trial: plan.trial });
  }
  return sold;
}

/** The plans to show, in order: the founder offer first while it is on sale, then Starter, Pro (the scale entry) and Association when the catalogue shows them. */
export function pricingPlans(entries: readonly PublicPrice[], locale: "en" | "fr", options: { founderOnSale: boolean }): PlanView[] {
  const plans: PlanView[] = [];
  for (const id of ["founder", "starter", "scale", "association"] as const) {
    if (id === "founder" && !options.founderOnSale) {continue;}
    const entry = entries.find((e) => e.key === KEYS[id]);
    if (!entry) {continue;}
    plans.push({
      id,
      price: entry.availability === AVAILABILITY.preparing ? null : priceText(entry, locale),
      limit: id === "founder" ? (entry.limits.founderCap ?? null) : null,
      trial: entry.availability === AVAILABILITY.preparing || trialDaysOf(entry) === 0 ? null : { days: trialDaysOf(entry), months: trialMonthsOf(entry) },
      features: featuresOf(id, entry, locale, entries.some((e) => e.key === KEYS.starter)),
    });
  }
  return plans;
}

/**
 * Where a plan's action leads (krizaka-internal#1913). A visitor goes to the demo shop (or the sign-in); an owner already signed in
 * goes to Subscription, which sells the same plans, so « Open my shop » never stands under a price. The founder plan keeps its checkout form.
 */
export function planAction(signedIn: boolean, association: boolean): "visit" | "subscription" {
  return signedIn || association ? "subscription" : "visit";
}

import { AVAILABILITY, type PublicPrice } from "@krizaka/settings";

import { centsText, priceText, rateText } from "./price-text";
import { FOUNDER, SCALE, STARTER } from "./pricing";

/**
 * The public pricing page's plans, built from the catalogue's public view (akinaza#380): every price, rate and cap is read from the
 * entries and formatted with the visitor's locale, never typed in a message. A feature that is not built says « soon » and carries
 * no figure; the founder plan appears only while its offer is on sale.
 */
export type FeatureId = "booking" | "invoices" | "books" | "payments" | "fees" | "contract" | "transfers";

export interface PlanFeature {
  id: FeatureId;
  /** Not built yet: worded « soon », with no figure. */
  soon: boolean;
  /** The figures of the message (only a feature that is built has any). */
  vars: Record<string, string>;
}
export interface PlanView {
  id: "founder" | "starter" | "scale";
  /** The amount, or null while the entry is in preparation (no figure is guessed). */
  price: string | null;
  /** The founder plan: the first businesses, limited by the catalogue's `founderCap`. */
  limit: number | null;
  features: PlanFeature[];
}

const KEYS = { founder: FOUNDER, starter: STARTER, scale: SCALE } as const;

const built = (id: FeatureId): PlanFeature => ({ id, soon: false, vars: {} });
const soon = (id: FeatureId): PlanFeature => ({ id, soon: true, vars: {} });

function featuresOf(plan: PlanView["id"], entry: PublicPrice, locale: "en" | "fr"): PlanFeature[] {
  const limits = entry.limits;
  const fees: PlanFeature[] =
    limits.cardFeeBps !== undefined && limits.directDebitBps !== undefined && limits.directDebitCapCents !== undefined
      ? [{ id: "fees", soon: false, vars: { cardRate: rateText(limits.cardFeeBps, locale), debitRate: rateText(limits.directDebitBps, locale), debitCap: centsText(limits.directDebitCapCents, locale) } }]
      : [];
  return [built("booking"), built("invoices"), built("books"), soon("payments"), ...fees, ...(plan === "scale" ? [soon("contract"), soon("transfers")] : [])];
}

/** The plans to show, in order: the founder offer first while it is on sale, then Starter and Scale B2B when the catalogue shows them. */
export function pricingPlans(entries: readonly PublicPrice[], locale: "en" | "fr", options: { founderOnSale: boolean }): PlanView[] {
  const plans: PlanView[] = [];
  for (const id of ["founder", "starter", "scale"] as const) {
    if (id === "founder" && !options.founderOnSale) continue;
    const entry = entries.find((e) => e.key === KEYS[id]);
    if (!entry) continue;
    plans.push({
      id,
      price: entry.availability === AVAILABILITY.preparing ? null : priceText(entry, locale),
      limit: id === "founder" ? (entry.limits.founderCap ?? null) : null,
      features: featuresOf(id, entry, locale),
    });
  }
  return plans;
}

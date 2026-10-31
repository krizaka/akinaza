import type { PriceEntry } from "@krizaka/settings";

/** What the processor needs that the price catalogue does not hold: the lookup key, the name on the invoice, the tax code. Never an amount. */
export interface ProcessorPlan {
  priceKey: string;
  lookupKey: string;
  name: string;
  taxCode: string;
}

export interface ProcessorPlans {
  product: string;
  plans: readonly ProcessorPlan[];
  portal: Record<string, unknown>;
}

/**
 * The catalogue the processor is set up with (`krizaka-payments-setup`): the amounts, the currency and the interval are READ from the
 * price catalogue in force (`price_versions`, the administrator's source of truth), never typed in a file (akinaza#633). An entry the
 * catalogue does not hold, or one without a figure (`preparing`), is an error: the processor never sells a guess.
 */
export function processorCatalogue(plans: ProcessorPlans, entries: readonly PriceEntry[]) {
  return {
    product: plans.product,
    plans: plans.plans.map((plan) => {
      const entry = entries.find((e) => e.key === plan.priceKey);
      if (!entry) {throw new Error(`No price in the catalogue for ${plan.priceKey}`);}
      if (entry.amountCents === null) {throw new Error(`${plan.priceKey} has no amount yet: it cannot be set up at the processor`);}
      return { lookupKey: plan.lookupKey, name: plan.name, amount: entry.amountCents, currency: entry.currency.toLowerCase(), interval: entry.unit, taxCode: plan.taxCode };
    }),
    portal: plans.portal,
  };
}

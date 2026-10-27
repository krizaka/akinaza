import { AVAILABILITY, definePrices, type Price, type PriceSeed, UNIT } from "@krizaka/settings";

/**
 * Akinaza's prices are data (ADR-009, krizaka/.github#253; akinaza#371): this module is only the **seed** of the catalogue
 * (`@krizaka/settings`), the values in force until the administrator schedules a change from the console (`/console/prices`).
 * Every page reads the catalogue (`lib/price-catalogue.ts`), never this file. Amounts are Canadian cents, **plus taxes**
 * (GST and QST are the processor's automatic tax). The processor's catalogue (`infra/payments/catalogue.json`, created by
 * `pnpm run payments:setup`) sells the same amounts, and `pricing.test.ts` keeps them equal.
 *
 * Limits, read by the code: `founderCap` (the founder entry: how many businesses it is offered to — it replaces the former
 * setting `plans.founder.limit`), `cardFeeBps` (0: never a fee on card payments), `directDebitBps` and
 * `directDebitCapCents` (pre-authorised debit or B2B transfer: Akinaza's orchestration fee, a rate capped per order; the
 * funds stay with the processor, Krizaka only takes an application fee).
 */
export const FOUNDER = "akinaza.founder";
export const STARTER = "akinaza.starter";
export const SCALE = "akinaza.scale";
export type PriceKey = typeof FOUNDER | typeof STARTER | typeof SCALE;

export const PRICE_SEED = [
  /** The founder offer: setup included, the first businesses only (`founderCap`); the administrator ends it by making it `internal`. A founder keeps the version it was sold at. */
  { product: "akinaza", plan: "founder", unit: UNIT.month, amountCents: 3900, availability: AVAILABILITY.founderLimited, limits: { founderCap: 20, cardFeeBps: 0, directDebitBps: 50, directDebitCapCents: 1500 } },
  /** Starter: the regular plan. */
  { product: "akinaza", plan: "starter", unit: UNIT.month, amountCents: 4500, availability: AVAILABILITY.public, limits: { cardFeeBps: 0, directDebitBps: 50, directDebitCapCents: 1500 } },
  /** Scale B2B: its B2B features are not built yet (worded « soon », never claimed). */
  { product: "akinaza", plan: "scale", unit: UNIT.month, amountCents: 9900, availability: AVAILABILITY.public, limits: { cardFeeBps: 0, directDebitBps: 25, directDebitCapCents: 1000 } },
] as const satisfies readonly PriceSeed[];

export const PRICES = definePrices(PRICE_SEED);

/** The processor's plan of each entry: the kind the payments port knows and the lookup key of its price (`infra/payments/catalogue.json`). */
export const PROCESSOR_PLANS = {
  [FOUNDER]: { kind: "founder", lookupKey: "akinaza_founder_monthly_cad" },
  [STARTER]: { kind: "starter", lookupKey: "akinaza_starter_monthly_cad" },
  [SCALE]: { kind: "scale", lookupKey: "akinaza_scale_monthly_cad" },
} as const satisfies Record<PriceKey, { kind: string; lookupKey: string }>;

// @fixed: basis points per whole (a unit conversion, not a business parameter)
const BPS = 10_000;

const orderCents = (amount: number) => {
  if (!Number.isInteger(amount) || amount < 0) throw new RangeError("An order amount is a whole number of cents");
  return amount;
};

/** The fee on a card payment of an order: `cardFeeBps` of it (0 in every entry: never a fee on cards). */
export function cardFeeCents(price: Pick<Price, "limits">, amount: number): number {
  return Math.round((orderCents(amount) * (price.limits.cardFeeBps ?? 0)) / BPS);
}

/** The fee on a pre-authorised debit or B2B transfer of an order: `directDebitBps` of it, never more than `directDebitCapCents`. */
export function directDebitFeeCents(price: Pick<Price, "limits">, amount: number): number {
  const fee = Math.round((orderCents(amount) * (price.limits.directDebitBps ?? 0)) / BPS);
  const cap = price.limits.directDebitCapCents;
  return cap === undefined ? fee : Math.min(fee, cap);
}

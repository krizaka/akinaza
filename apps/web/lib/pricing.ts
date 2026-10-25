/**
 * Akinaza's prices: the one place a plan's amount is written (akinaza#363). The processor's catalogue
 * (`payments/catalogue.json`, created by `pnpm run payments:setup`) is the same data, and `pricing.test.ts` keeps them equal;
 * the pages never type an amount: the founder price shown is read from the processor by lookup key and formatted with the
 * locale. All amounts are Canadian cents, **taxes extra** (GST and QST are the processor's automatic tax).
 *
 * Never a percentage of what a business's clients pay: a plan is a flat monthly subscription (a test refuses any fee field).
 */
export const PLANS = {
  /** The founder offer: setup included, kept for as long as the subscription runs, closed after the first businesses (the setting `plans.founder.limit`). */
  founder: { lookupKey: "akinaza_founder_monthly_cad", cents: 3900, currency: "cad", interval: "month", public: true },
  /** The regular plan, in the catalogue and not shown anywhere until sign-up opens (`public: false`). */
  regular: { lookupKey: "akinaza_regular_monthly_cad", cents: 4900, currency: "cad", interval: "month", public: false },
} as const;

export type PlanId = keyof typeof PLANS;

/** The plans a visitor may see: the regular plan is not among them while it is not public. */
export function publicPlans(): Partial<Record<PlanId, (typeof PLANS)[PlanId]>> {
  return Object.fromEntries(Object.entries(PLANS).filter(([, plan]) => plan.public)) as Partial<Record<PlanId, (typeof PLANS)[PlanId]>>;
}

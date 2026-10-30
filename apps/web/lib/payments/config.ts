import { type PaymentsPort, stripeAdapter } from "@krizaka/payments";

import { ASSOCIATION, FOUNDER, PROCESSOR_PLANS, SCALE, STARTER } from "../pricing";

/** The settings the payments vendor needs — read from the environment by the edge (a route), passed in. */
export interface PaymentsSettings {
  PAYMENTS_PROVIDER?: string;
  PAYMENTS_STRIPE_SECRET_KEY?: string;
  PAYMENTS_STRIPE_WEBHOOK_SECRET?: string;
  PAYMENTS_PRICE_KEY_FOUNDER: string;
  PAYMENTS_PRICE_KEY_STARTER: string;
  PAYMENTS_PRICE_KEY_SCALE: string;
  PAYMENTS_PRICE_KEY_ASSOCIATION: string;
}

/** Akinaza's plans at the processor (`lib/pricing.ts`, akinaza#371): the founder offer, Starter and Scale are subscriptions, found by lookup key. */
export const FOUNDER_PLAN = PROCESSOR_PLANS[FOUNDER].kind;
export const STARTER_PLAN = PROCESSOR_PLANS[STARTER].kind;
export const SCALE_PLAN = PROCESSOR_PLANS[SCALE].kind;
export const ASSOCIATION_PLAN = PROCESSOR_PLANS[ASSOCIATION].kind;

/** Whether the processor key is a live-mode one: a free trial is a test-mode feature until it is proven (the founder, 2026-10-30), so live refuses it. */
export const isLiveMode = (e: Pick<PaymentsSettings, "PAYMENTS_STRIPE_SECRET_KEY">): boolean => e.PAYMENTS_STRIPE_SECRET_KEY?.startsWith("sk_live_") === true;

/** The only place a payments vendor is chosen (the adapter itself is @krizaka/payments). Null = payments are off. */
export function paymentsFrom(e: PaymentsSettings): PaymentsPort | null {
  if (e.PAYMENTS_PROVIDER !== "stripe" || !e.PAYMENTS_STRIPE_SECRET_KEY || !e.PAYMENTS_STRIPE_WEBHOOK_SECRET) return null;
  return stripeAdapter({
    secretKey: e.PAYMENTS_STRIPE_SECRET_KEY,
    webhookSecret: e.PAYMENTS_STRIPE_WEBHOOK_SECRET,
    plans: {
      [FOUNDER_PLAN]: { lookupKey: e.PAYMENTS_PRICE_KEY_FOUNDER, mode: "subscription" },
      [STARTER_PLAN]: { lookupKey: e.PAYMENTS_PRICE_KEY_STARTER, mode: "subscription" },
      [SCALE_PLAN]: { lookupKey: e.PAYMENTS_PRICE_KEY_SCALE, mode: "subscription" },
      [ASSOCIATION_PLAN]: { lookupKey: e.PAYMENTS_PRICE_KEY_ASSOCIATION, mode: "subscription" },
    },
  });
}

import { type PaymentsPort, stripeAdapter } from "@krizaka/payments";

import { PROCESSOR_PLANS, SCALE, STARTER } from "../pricing";

/** The settings the payments vendor needs — read from the environment by the edge (a route), passed in. */
export interface PaymentsSettings {
  PAYMENTS_PROVIDER?: string;
  PAYMENTS_STRIPE_SECRET_KEY?: string;
  PAYMENTS_STRIPE_WEBHOOK_SECRET?: string;
  PAYMENTS_PRICE_KEY_STARTER: string;
  PAYMENTS_PRICE_KEY_SCALE: string;
}

/** Akinaza's plans at the processor (`lib/pricing.ts`, akinaza#371): Starter and Scale are subscriptions, found by lookup key. */
export const STARTER_PLAN = PROCESSOR_PLANS[STARTER].kind;
export const SCALE_PLAN = PROCESSOR_PLANS[SCALE].kind;

/** The only place a payments vendor is chosen (the adapter itself is @krizaka/payments). Null = payments are off. */
export function paymentsFrom(e: PaymentsSettings): PaymentsPort | null {
  if (e.PAYMENTS_PROVIDER !== "stripe" || !e.PAYMENTS_STRIPE_SECRET_KEY || !e.PAYMENTS_STRIPE_WEBHOOK_SECRET) return null;
  return stripeAdapter({
    secretKey: e.PAYMENTS_STRIPE_SECRET_KEY,
    webhookSecret: e.PAYMENTS_STRIPE_WEBHOOK_SECRET,
    plans: {
      [STARTER_PLAN]: { lookupKey: e.PAYMENTS_PRICE_KEY_STARTER, mode: "subscription" },
      [SCALE_PLAN]: { lookupKey: e.PAYMENTS_PRICE_KEY_SCALE, mode: "subscription" },
    },
  });
}

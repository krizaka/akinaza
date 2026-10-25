import { type PaymentsPort, stripeAdapter } from "@krizaka/payments";

/** The settings the payments vendor needs — read from the environment by the edge (a route), passed in. */
export interface PaymentsSettings {
  PAYMENTS_PROVIDER?: string;
  PAYMENTS_STRIPE_SECRET_KEY?: string;
  PAYMENTS_STRIPE_WEBHOOK_SECRET?: string;
  PAYMENTS_PRICE_KEY_FOUNDER: string;
  PAYMENTS_PRICE_KEY_REGULAR: string;
}

/** Akinaza's plans (lib/pricing.ts): the founder offer and the regular plan are subscriptions; the price is the processor's data, found by lookup key. */
export const FOUNDER = "founder";
export const REGULAR = "regular";

/** The only place a payments vendor is chosen (the adapter itself is @krizaka/payments). Null = payments are off. */
export function paymentsFrom(e: PaymentsSettings): PaymentsPort | null {
  if (e.PAYMENTS_PROVIDER !== "stripe" || !e.PAYMENTS_STRIPE_SECRET_KEY || !e.PAYMENTS_STRIPE_WEBHOOK_SECRET) return null;
  return stripeAdapter({
    secretKey: e.PAYMENTS_STRIPE_SECRET_KEY,
    webhookSecret: e.PAYMENTS_STRIPE_WEBHOOK_SECRET,
    plans: {
      [FOUNDER]: { lookupKey: e.PAYMENTS_PRICE_KEY_FOUNDER, mode: "subscription" },
      [REGULAR]: { lookupKey: e.PAYMENTS_PRICE_KEY_REGULAR, mode: "subscription" },
    },
  });
}

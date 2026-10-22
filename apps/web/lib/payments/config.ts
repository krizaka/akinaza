import type { PaymentsPort, PlanKind } from "./port";
import { stripeAdapter } from "./stripe-adapter";

/** The settings the payments vendor needs — read from the environment by the edge (a route), passed in. */
export interface PaymentsSettings {
  PAYMENTS_PROVIDER?: string;
  PAYMENTS_STRIPE_SECRET_KEY?: string;
  PAYMENTS_STRIPE_WEBHOOK_SECRET?: string;
  PAYMENTS_PRICE_KEY_FOUNDER: string;
}

/** The only place a payments vendor is chosen. Null = payments are off. */
export function paymentsFrom(e: PaymentsSettings): PaymentsPort | null {
  if (e.PAYMENTS_PROVIDER !== "stripe" || !e.PAYMENTS_STRIPE_SECRET_KEY || !e.PAYMENTS_STRIPE_WEBHOOK_SECRET) return null;
  const priceKeys: Record<PlanKind, string> = { founder: e.PAYMENTS_PRICE_KEY_FOUNDER };
  return stripeAdapter({ secretKey: e.PAYMENTS_STRIPE_SECRET_KEY, webhookSecret: e.PAYMENTS_STRIPE_WEBHOOK_SECRET, priceKeys });
}

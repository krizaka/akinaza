import { describe, expect, it } from "vitest";

import { paymentsFrom } from "./config";

const base = { PAYMENTS_PRICE_KEY_FOUNDER: "k" };
describe("the vendor is configuration", () => {
  it("is off unless a provider and its secrets are set", () => {
    expect(paymentsFrom(base)).toBeNull();
    expect(paymentsFrom({ ...base, PAYMENTS_PROVIDER: "stripe", PAYMENTS_STRIPE_SECRET_KEY: "x" })).toBeNull();
    expect(paymentsFrom({ ...base, PAYMENTS_PROVIDER: "other", PAYMENTS_STRIPE_SECRET_KEY: "x", PAYMENTS_STRIPE_WEBHOOK_SECRET: "y" })).toBeNull();
  });
  it("builds the Stripe adapter behind the port", () => {
    const port = paymentsFrom({ ...base, PAYMENTS_PROVIDER: "stripe", PAYMENTS_STRIPE_SECRET_KEY: "x", PAYMENTS_STRIPE_WEBHOOK_SECRET: "y" });
    expect(typeof port?.checkout).toBe("function");
    expect(typeof port?.parseWebhook).toBe("function");
  });
});

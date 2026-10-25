import { describe, expect, it } from "vitest";

import { paymentsFrom } from "./config";

const base = { PAYMENTS_PRICE_KEY_FOUNDER: "k", PAYMENTS_PRICE_KEY_REGULAR: "r" };
describe("the vendor is configuration", () => {
  it("is off unless a provider and its keys are set", () => {
    expect(paymentsFrom(base)).toBeNull();
    expect(paymentsFrom({ ...base, PAYMENTS_PROVIDER: "stripe", PAYMENTS_STRIPE_SECRET_KEY: "x" })).toBeNull();
    expect(paymentsFrom({ ...base, PAYMENTS_PROVIDER: "other", PAYMENTS_STRIPE_SECRET_KEY: "x", PAYMENTS_STRIPE_WEBHOOK_SECRET: "y" })).toBeNull();
  });
  it("builds the shared adapter behind the port, with the founder plan by lookup key", async () => {
    const port = paymentsFrom({ ...base, PAYMENTS_PROVIDER: "stripe", PAYMENTS_STRIPE_SECRET_KEY: "x", PAYMENTS_STRIPE_WEBHOOK_SECRET: "y" });
    expect(typeof port?.checkout).toBe("function");
    await expect(port!.price("unknown")).rejects.toThrow(/Unknown plan/);
  });
});

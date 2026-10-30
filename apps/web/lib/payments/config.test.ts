import { describe, expect, it } from "vitest";

import { isLiveMode, paymentsFrom } from "./config";

const base = { PAYMENTS_PRICE_KEY_FOUNDER: "f", PAYMENTS_PRICE_KEY_STARTER: "k", PAYMENTS_PRICE_KEY_SCALE: "r", PAYMENTS_PRICE_KEY_ASSOCIATION: "a" };
describe("the vendor is configuration", () => {
  it("is off unless a provider and its keys are set", () => {
    expect(paymentsFrom(base)).toBeNull();
    expect(paymentsFrom({ ...base, PAYMENTS_PROVIDER: "stripe", PAYMENTS_STRIPE_SECRET_KEY: "x" })).toBeNull();
    expect(paymentsFrom({ ...base, PAYMENTS_PROVIDER: "other", PAYMENTS_STRIPE_SECRET_KEY: "x", PAYMENTS_STRIPE_WEBHOOK_SECRET: "y" })).toBeNull();
  });
  it("builds the shared adapter behind the port, with the founder, Starter and Scale plans by lookup key", async () => {
    const port = paymentsFrom({ ...base, PAYMENTS_PROVIDER: "stripe", PAYMENTS_STRIPE_SECRET_KEY: "x", PAYMENTS_STRIPE_WEBHOOK_SECRET: "y" });
    expect(typeof port?.checkout).toBe("function");
    await expect(port!.price("unknown")).rejects.toThrow(/Unknown plan/);
  });
  it("a live processor key is recognised (the free trial is refused on it), a test key is not", () => {
    expect(isLiveMode({ PAYMENTS_STRIPE_SECRET_KEY: "sk_live_abc" })).toBe(true);
    expect(isLiveMode({ PAYMENTS_STRIPE_SECRET_KEY: "sk_test_abc" })).toBe(false);
    expect(isLiveMode({})).toBe(false);
  });
});

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

describe("the domain and the routes know no vendor", () => {
  it("billing.ts and the routes import the port/config, never the adapter or a vendor name", () => {
    for (const f of ["lib/billing.ts", "app/api/billing/checkout/route.ts", "app/api/billing/portal/route.ts", "app/api/webhooks/payments/route.ts"]) {
      const src = read(f);
      expect(src, f).not.toMatch(/stripe/i);
    }
  });
  it("only config.ts imports the adapter", () => {
    expect(read("lib/payments/config.ts")).toMatch(/stripe-adapter/);
    expect(read("lib/payments/port.ts")).not.toMatch(/^import /m);
  });
});

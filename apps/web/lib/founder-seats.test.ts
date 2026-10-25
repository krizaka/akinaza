import { describe, expect, it } from "vitest";

import { applyPaymentEvent, founderGate, founderSeats } from "./billing";

/** A stand-in for the `accounts` table: the accounts that hold a subscription (a founder's), and the SQL it was asked. */
function accounts(subscribed: string[]) {
  const sql: string[] = [];
  const query = (async (text: string, values: unknown[] = []) => {
    sql.push(text);
    if (/count\(\*\)/i.test(text)) return [{ taken: subscribed.length }];
    if (/SELECT payment_subscription_id/i.test(text)) return [{ sub: subscribed.includes(String(values[0])) ? "sub_1" : null }];
    return [{ id: "a1" }];
  }) as never;
  return { query, sql };
}
const some = (n: number) => Array.from({ length: n }, (_, i) => `a${i}`);

describe("the founder offer closes at its limit (akinaza#363)", () => {
  it("is open below the limit and complete at it, the limit being a setting", async () => {
    expect(await founderSeats(accounts(some(19)).query, 20)).toEqual({ limit: 20, taken: 19, open: true });
    expect(await founderSeats(accounts(some(20)).query, 20)).toEqual({ limit: 20, taken: 20, open: false });
    expect(await founderSeats(accounts(some(25)).query, 20)).toMatchObject({ open: false });
    // The administrator raises the limit: the offer is open again, with no deployment.
    expect(await founderSeats(accounts(some(20)).query, 30)).toMatchObject({ limit: 30, open: true });
  });

  it("a new business is turned away once the limit is reached", async () => {
    expect(await founderGate(accounts(some(20)).query, "newcomer", 20)).toBe("full");
    expect(await founderGate(accounts(some(3)).query, "newcomer", 20)).toBe("open");
  });

  it("a founder keeps the offer for as long as the subscription is theirs: the limit never turns a member away", async () => {
    expect(await founderGate(accounts(some(20)).query, "a7", 20)).toBe("member");
    expect(await founderGate(accounts(some(500)).query, "a7", 20)).toBe("member");
    // Even when the limit is lowered under the number of founders.
    expect(await founderGate(accounts(some(20)).query, "a7", 1)).toBe("member");
  });
});

describe("a founder keeps the founder price as long as the subscription runs (akinaza#363)", () => {
  it("the notifications of the processor write the state of the subscription, never its price or plan", async () => {
    const { query, sql } = accounts([]);
    const events = [
      { id: "e1", type: "subscription_started", accountId: "a1", customerId: "cus_1", subscriptionId: "sub_1" },
      { id: "e2", type: "subscription_changed", accountId: "a1", customerId: "cus_1", subscriptionId: "sub_1", status: "active", active: true, periodEnd: 1_800_000_000 },
      { id: "e3", type: "subscription_changed", accountId: "a1", customerId: "cus_1", subscriptionId: "sub_1", status: "past_due", active: false, periodEnd: 1_800_000_000 },
    ] as const;
    for (const event of events) await applyPaymentEvent(query, event);
    const writes = sql.filter((s) => /^\s*UPDATE/i.test(s));
    expect(writes.length).toBeGreaterThan(0);
    for (const write of writes) expect(write, write).not.toMatch(/price|plan|amount|lookup/i);
  });

  it("the port has no way to change a subscription's price: it creates, opens the hosted page and reads", async () => {
    const { stripeAdapter } = await import("@krizaka/payments");
    const port = stripeAdapter({ secretKey: "x", webhookSecret: "y", plans: { founder: { lookupKey: "k", mode: "subscription" } } });
    expect(Object.keys(port).sort()).toEqual(["checkout", "createCustomer", "parseWebhook", "portal", "price"]);
  });
});

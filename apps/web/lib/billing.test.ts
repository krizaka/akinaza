import { describe, expect, it } from "vitest";

import { applyPaymentEvent, customerOf, subscriptionOf } from "./billing";

type Row = Record<string, unknown>;
/** A tiny in-memory stand-in for the two tables, enough to prove the domain's rules (the SQL itself runs in the proof against PostgreSQL). */
function fake() {
  const seen = new Set<string>();
  const log: string[] = [];
  const query = (async (text: string, values: unknown[] = []) => {
    log.push(text.split("\n")[0]!.slice(0, 40));
    if (text.startsWith("INSERT INTO payment_events")) {
      const id = String(values[0]);
      if (seen.has(id)) return [];
      seen.add(id);
      return [{ id }];
    }
    return [{ id: "a1" }] as Row[];
  }) as never;
  return { query, log, seen };
}

describe("payment events are applied once", () => {
  it("a replayed event changes nothing", async () => {
    const { query, log } = fake();
    const event = { id: "evt_1", type: "subscription_started", accountId: "a1", customerId: "cus_1", subscriptionId: "sub_1" } as const;
    expect(await applyPaymentEvent(query, event)).toBe("applied");
    const writes = log.length;
    expect(await applyPaymentEvent(query, event)).toBe("duplicate");
    expect(log.length).toBe(writes + 1); // only the id insert, which found it
  });
  it("an ignored event is not even recorded", async () => {
    const { query, seen } = fake();
    expect(await applyPaymentEvent(query, { id: "evt_x", type: "ignored" })).toBe("ignored");
    expect(seen.size).toBe(0);
  });
});

describe("the subscription state", () => {
  const at = (status: string | null, end: Date | null) => (async () => [{ status, end, customer: "cus_1" }]) as never;
  const now = new Date("2026-11-01T00:00:00Z");
  it("is active while the processor says active/trialing and the period has not ended", async () => {
    expect((await subscriptionOf(at("active", new Date("2026-12-01")), "a1", now)).active).toBe(true);
    expect((await subscriptionOf(at("trialing", null), "a1", now)).active).toBe(true);
    expect((await subscriptionOf(at("active", new Date("2026-10-01")), "a1", now)).active).toBe(false);
    expect((await subscriptionOf(at("canceled", new Date("2026-12-01")), "a1", now)).active).toBe(false);
    expect((await subscriptionOf(at(null, null), "a1", now)).active).toBe(false);
  });
  it("creates the customer once and reuses it", async () => {
    let creates = 0;
    const existing = (async () => [{ customer: "cus_old" }]) as never;
    expect(await customerOf(existing, "a1", async () => { creates++; return { id: "cus_new" }; })).toBe("cus_old");
    expect(creates).toBe(0);
  });
});

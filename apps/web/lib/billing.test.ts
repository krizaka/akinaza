import type { PaymentEvent } from "@krizaka/payments";
import { describe, expect, it } from "vitest";

import { applyPaymentEvent, customerOf, subscriptionOf } from "./billing";

type Row = Record<string, unknown>;
/**
 * A tiny in-memory stand-in for the two tables with real transaction semantics: a write inside `transaction` is visible only
 * when the work returns, and is dropped when it throws (the SQL itself runs in the proof against PostgreSQL).
 */
function fake(failNext = { value: false }) {
  const committed = { events: new Set<string>(), accounts: 0 };
  const transaction = (async (work: (q: never) => Promise<unknown>) => {
    const staged = { events: new Set(committed.events), accounts: committed.accounts };
    const query = (async (text: string, values: unknown[] = []) => {
      if (text.includes("INSERT INTO") && text.includes("payment_events")) {
        const id = String(values[0]);
        if (staged.events.has(id)) return [];
        staged.events.add(id);
        return [{ id }];
      }
      if (text.startsWith("UPDATE accounts SET payment_subscription_id")) {
        if (failNext.value) throw new Error("database went away");
        staged.accounts += 1;
      }
      return [{ id: "a1" }] as Row[];
    }) as never;
    const result = await work(query);
    committed.events = staged.events;
    committed.accounts = staged.accounts;
    return result;
  }) as never;
  return { transaction, committed };
}

const paid = { checkoutRef: null, paymentRef: null, invoiceRef: null, amountTotal: null, amountDiscount: 0, currency: null, metadata: {} };
const started: PaymentEvent = { id: "evt_1", type: "subscription_started", accountId: "a1", customerId: "cus_1", subscriptionId: "sub_1", ...paid };

describe("payment events are applied once", () => {
  it("a replayed event changes nothing", async () => {
    const { transaction, committed } = fake();
    expect(await applyPaymentEvent(transaction, started)).toBe("applied");
    expect(await applyPaymentEvent(transaction, started)).toBe("duplicate");
    expect(committed.accounts).toBe(1);
  });
  it("an ignored event is not even recorded", async () => {
    const { transaction, committed } = fake();
    expect(await applyPaymentEvent(transaction, { id: "evt_x", type: "ignored" })).toBe("ignored");
    expect(committed.events.size).toBe(0);
  });
  it("a throwing handler leaves no record and no state change, and the redelivery applies once", async () => {
    const failing = { value: true };
    const { transaction, committed } = fake(failing);
    await expect(applyPaymentEvent(transaction, started)).rejects.toThrow("database went away");
    expect(committed.events.size).toBe(0);
    expect(committed.accounts).toBe(0);
    failing.value = false;
    expect(await applyPaymentEvent(transaction, started)).toBe("applied");
    expect(await applyPaymentEvent(transaction, started)).toBe("duplicate");
    expect(committed.accounts).toBe(1);
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

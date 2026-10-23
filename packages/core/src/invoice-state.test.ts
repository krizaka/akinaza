import { describe, expect, it } from "vitest";

import { invoiceState, remainingCents } from "./invoice-state";

const base = { totalCents: 11_498, paidCents: 0, dueOn: "2026-10-30", isCredit: false, superseded: false };

describe("where an invoice stands (akinaza#218)", () => {
  it("due, partly paid, paid, then overdue once its due date has passed with money owed", () => {
    expect(invoiceState(base, "2026-10-23")).toBe("due");
    expect(invoiceState({ ...base, paidCents: 5_000 }, "2026-10-23")).toBe("partial");
    expect(invoiceState({ ...base, paidCents: 11_498 }, "2026-11-15")).toBe("paid");
    expect(invoiceState(base, "2026-10-31")).toBe("overdue");
    expect(invoiceState({ ...base, paidCents: 5_000 }, "2026-10-31")).toBe("overdue");
    expect(invoiceState({ ...base, dueOn: null }, "2027-01-01")).toBe("due");
  });

  it("a credit note is one; an invoice it cancelled, or a correction replaced, is cancelled and owes nothing", () => {
    expect(invoiceState({ ...base, isCredit: true }, "2026-10-31")).toBe("credit");
    expect(invoiceState({ ...base, superseded: true }, "2026-10-31")).toBe("cancelled");
    expect(remainingCents({ ...base, superseded: true })).toBe(0);
    expect(remainingCents({ ...base, paidCents: 5_000 })).toBe(6_498);
  });
});

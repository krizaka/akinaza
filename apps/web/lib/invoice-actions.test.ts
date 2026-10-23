import { describe, expect, it } from "vitest";

import { invoiceActions, type InvoiceStanding } from "./invoice-actions";

const invoice = (patch: Partial<InvoiceStanding> = {}): InvoiceStanding => ({ creditOf: null, creditedBy: null, replacedBy: null, clientId: "c-1", dueOn: "2026-11-22", totalCents: 11_498, paidCents: 0, ...patch });

describe("what an invoice's page offers, by its state (docs/ux/2026-10-full-review.md D3)", () => {
  it("lets a due invoice with a client be sent, corrected and printed", () => {
    expect(invoiceActions(invoice(), "2026-10-23")).toEqual({ send: true, correct: true, print: true, state: "due" });
  });

  it("says when it is overdue, and keeps the same actions", () => {
    expect(invoiceActions(invoice(), "2026-12-01")).toMatchObject({ send: true, correct: true, state: "overdue" });
  });

  it("never sends an invoice without a client's file", () => {
    expect(invoiceActions(invoice({ clientId: null }), "2026-10-23")).toMatchObject({ send: false, correct: true, print: true });
  });

  it("neither sends nor corrects a credit note, nor an invoice already credited or replaced", () => {
    expect(invoiceActions(invoice({ creditOf: "i-1", totalCents: -11_498 }), "2026-10-23")).toMatchObject({ send: false, correct: false, state: "credit" });
    expect(invoiceActions(invoice({ creditedBy: { id: "i-2" } }), "2026-10-23")).toMatchObject({ send: false, correct: false, state: "cancelled" });
    expect(invoiceActions(invoice({ replacedBy: { id: "i-3" }, creditedBy: { id: "i-2" } }), "2026-10-23")).toMatchObject({ correct: false });
  });

  it("reads a paid invoice as paid, and offers to print it", () => {
    expect(invoiceActions(invoice({ paidCents: 11_498 }), "2026-10-23")).toMatchObject({ state: "paid", print: true, correct: true });
  });
});

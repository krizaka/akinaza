import type { ActionsInput } from "./actions";
import type { FiguresInput } from "./figures";

/**
 * A shop's fourth quarter, with amounts worked out by hand from the ledger's own rules (GST 5 %, QST 9.975 % rounded half away from zero):
 * an invoice partly paid and overdue, one paid in full, one cancelled by its credit note, two expenses (one used half for the business).
 */
export const TODAY = "2026-10-23";
export const PERIOD = { start: "2026-10-01", end: "2026-12-31" } as const;

export const input = (over: Partial<FiguresInput> = {}): FiguresInput => ({
  today: TODAY,
  computedAt: "2026-10-23T12:00:00.000Z",
  period: PERIOD,
  invoices: [
    { id: "inv-a", number: "F-0001", issuedOn: "2026-10-03", dueOn: "2026-10-10", subtotalCents: 10_000, gstCents: 500, qstCents: 998, totalCents: 11_498, paidCents: 5_000, isCredit: false, superseded: false },
    { id: "inv-b", number: "F-0002", issuedOn: "2026-10-15", dueOn: "2026-11-15", subtotalCents: 20_000, gstCents: 1_000, qstCents: 1_995, totalCents: 22_995, paidCents: 22_995, isCredit: false, superseded: false },
    { id: "inv-x", number: "F-0003", issuedOn: "2026-10-02", dueOn: "2026-10-30", subtotalCents: 5_000, gstCents: 250, qstCents: 499, totalCents: 5_749, paidCents: 0, isCredit: false, superseded: true },
    { id: "inv-cn", number: "NC-0001", issuedOn: "2026-10-12", dueOn: null, subtotalCents: -5_000, gstCents: -250, qstCents: -499, totalCents: -5_749, paidCents: 0, isCredit: true, superseded: false },
  ],
  payments: [
    { id: "pay-a", invoiceId: "inv-a", amountCents: 5_000, receivedOn: "2026-10-05" },
    { id: "pay-b", invoiceId: "inv-b", amountCents: 22_995, receivedOn: "2026-10-20" },
  ],
  expenses: [
    { id: "exp-1", supplier: "Fournisseur Beauté inc.", paidOn: "2026-10-05", subtotalCents: 8_000, gstCents: 400, qstCents: 798, businessSharePct: 100 },
    { id: "exp-2", supplier: "Vidéotron", paidOn: "2026-10-09", subtotalCents: 4_000, gstCents: 200, qstCents: 399, businessSharePct: 50 },
    { id: "exp-old", supplier: "Last year", paidOn: "2026-06-09", subtotalCents: 99_999, gstCents: 5_000, qstCents: 9_975, businessSharePct: 100 },
  ],
  appointments: [
    ...Array.from({ length: 8 }, (_, i) => ({ id: `ap-done-${i}`, day: `2026-10-1${i}`, status: "done" as const })),
    { id: "ap-ns", day: "2026-10-14", status: "noShow" as const },
    { id: "ap-cx", day: "2026-10-15", status: "cancelled" as const },
    { id: "ap-next", day: "2026-10-27", status: "booked" as const },
  ],
  ...over,
});

export const actionsInput = (over: Partial<ActionsInput> = {}, figuresOver: Partial<FiguresInput> = {}): ActionsInput => {
  const f = input(figuresOver);
  return { figures: { today: f.today, invoices: f.invoices, period: f.period }, returnPrepared: false, slots: [], ...over };
};

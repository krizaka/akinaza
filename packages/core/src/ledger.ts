import { applyRate, type Cents } from "./money";

/**
 * The tax ledger: an append-only journal of what the shop collected (on its invoices) and what it may claim back (input
 * tax credits, ITC, for the GST; input tax refunds, ITR, for the QST — on its business expenses). A correction is a new
 * entry (a credit note posts negative amounts), never an edit.
 */
export type Tax = "gst" | "qst";
export type Direction = "collected" | "credit";

export interface LedgerEntry {
  /** The first day of the period's month (`2026-10-01`): the period of a return is a set of months. */
  period: string;
  tax: Tax;
  direction: Direction;
  amountCents: Cents;
  source: { kind: "invoice" | "expense"; id: string; label: string };
}

/** The entries an issued invoice posts: the GST and the QST it collected (nothing for a zero amount). */
export function invoiceEntries(invoice: { id: string; number: string; issuedOn: string; gstCents: Cents; qstCents: Cents }): LedgerEntry[] {
  const period = `${invoice.issuedOn.slice(0, 7)}-01`;
  const source = { kind: "invoice" as const, id: invoice.id, label: invoice.number };
  return [
    { period, tax: "gst" as const, direction: "collected" as const, amountCents: invoice.gstCents, source },
    { period, tax: "qst" as const, direction: "collected" as const, amountCents: invoice.qstCents, source },
  ].filter((e) => e.amountCents !== 0);
}

/**
 * The credits an expense gives: the GST and QST paid, times the share used for the business (a phone used half for the
 * shop claims half), rounded half away from zero to the cent. Entertainment and other restricted expenses are the merchant's call
 * (the share), shown as such in the working papers.
 */
export function expenseEntries(expense: { id: string; supplier: string; paidOn: string; gstCents: Cents; qstCents: Cents; businessSharePct: number }): LedgerEntry[] {
  if (!Number.isInteger(expense.businessSharePct) || expense.businessSharePct < 0 || expense.businessSharePct > 100) throw new RangeError("business share is a whole percentage, 0 to 100");
  const share = (c: Cents) => applyRate(c, { numerator: expense.businessSharePct, denominator: 100 });
  const period = `${expense.paidOn.slice(0, 7)}-01`;
  const source = { kind: "expense" as const, id: expense.id, label: expense.supplier };
  return [
    { period, tax: "gst" as const, direction: "credit" as const, amountCents: share(expense.gstCents), source },
    { period, tax: "qst" as const, direction: "credit" as const, amountCents: share(expense.qstCents), source },
  ].filter((e) => e.amountCents !== 0);
}

export interface Balance {
  collected: Cents;
  credits: Cents;
  /** Positive: to remit; negative: a refund to claim. */
  net: Cents;
}

/** The balance of one tax over a set of entries. collected − credits = net, always (the invariant tests hold it). */
export function balance(entries: readonly LedgerEntry[], tax: Tax): Balance {
  const of = (d: Direction) => entries.filter((e) => e.tax === tax && e.direction === d).reduce((s, e) => s + e.amountCents, 0);
  const collected = of("collected");
  const credits = of("credit");
  return { collected, credits, net: collected - credits };
}

import { INVOICE_STATE, type InvoiceState, invoiceState } from "@akinaza/core";

/** The tone of an invoice's state chip; the word carries the meaning, the colour only repeats it. */
export const STATE_TONE: Record<InvoiceState, "neutral" | "success" | "warning" | "danger" | "accent"> = { credit: "warning", cancelled: "neutral", paid: "success", partial: "accent", overdue: "danger", due: "neutral" };

/** What the invoice page knows of an invoice to decide what it offers. */
export interface InvoiceStanding {
  creditOf: string | null;
  creditedBy: { id: string } | null;
  replacedBy: { id: string } | null;
  clientId: string | null;
  dueOn: string | null;
  totalCents: number;
  paidCents: number;
}

/**
 * The actions of an invoice's page (docs/ux/2026-10-full-review.md D3), by its state: sending needs a client; correcting
 * (#207) is for an invoice that still stands — never a credit note, never one already credited or replaced; printing is
 * always there. The chip's word comes from the same rule as the list's (`invoiceState`).
 */
export function invoiceActions(invoice: InvoiceStanding, today: string): { send: boolean; correct: boolean; print: true; state: InvoiceState } {
  const superseded = invoice.creditedBy !== null || invoice.replacedBy !== null;
  const state = invoiceState({ totalCents: invoice.totalCents, paidCents: invoice.paidCents, dueOn: invoice.dueOn, isCredit: invoice.creditOf !== null, superseded }, today);
  return { send: invoice.clientId !== null && state !== INVOICE_STATE.credit && state !== INVOICE_STATE.cancelled, correct: invoice.creditOf === null && !superseded, print: true, state };
}

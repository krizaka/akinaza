import { isPastDue } from "./payment-terms";

/**
 * Where an invoice stands for the list (akinaza#218): a credit note; an invoice cancelled by a credit note or replaced by a
 * correction (#207); paid in full; partly paid; overdue (its due date passed with money still owed); or due. Integer cents,
 * the shop's calendar day as `yyyy-MM-dd`. Pure.
 */
export const INVOICE_STATE = { credit: "credit", cancelled: "cancelled", paid: "paid", partial: "partial", overdue: "overdue", due: "due" } as const;
export type InvoiceState = (typeof INVOICE_STATE)[keyof typeof INVOICE_STATE];

export interface InvoiceStanding {
  totalCents: number;
  paidCents: number;
  dueOn: string | null;
  /** It is itself a credit note. */
  isCredit: boolean;
  /** A credit note cancelled it, or a correction replaced it. */
  superseded: boolean;
}

export function invoiceState(invoice: InvoiceStanding, today: string): InvoiceState {
  if (invoice.isCredit) return INVOICE_STATE.credit;
  if (invoice.superseded) return INVOICE_STATE.cancelled;
  if (invoice.paidCents >= invoice.totalCents) return INVOICE_STATE.paid;
  if (isPastDue(invoice.dueOn, today)) return INVOICE_STATE.overdue;
  return invoice.paidCents > 0 ? INVOICE_STATE.partial : INVOICE_STATE.due;
}

/** What is still owed on it (never negative; nothing on a credit note or a cancelled invoice). */
export const remainingCents = (invoice: InvoiceStanding): number => (invoice.isCredit || invoice.superseded ? 0 : Math.max(0, invoice.totalCents - invoice.paidCents));

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "./client";
import { ShopError } from "./errors";
import { invoices, payments } from "./schema";

export const paymentInputSchema = z.object({ method: z.enum(["cash", "card", "transfer", "other"]), amountCents: z.number().int().min(1).max(100_000_000) });
export type PaymentInput = z.input<typeof paymentInputSchema>;

export interface PaymentResult {
  paymentId: string;
  totalCents: number;
  paidCents: number;
  /** The invoice is now paid in full. */
  paid: boolean;
  /** This payment is the one that completed it (the moment `invoice.paid` is told). */
  becamePaid: boolean;
}

/**
 * Records a payment received against one of the shop's invoices (recorded, not processed). A credit note takes none; a payment may not
 * exceed what is still due; the invoice row is locked so two payments never both think they completed it.
 */
export async function recordPayment(db: Db, shopId: string, invoiceId: string, raw: PaymentInput, now: Date): Promise<PaymentResult> {
  const input = paymentInputSchema.parse(raw);
  return db.transaction(async (tx) => {
    const [invoice] = await tx.select({ id: invoices.id, totalCents: invoices.totalCents, creditOf: invoices.creditOf }).from(invoices).where(and(eq(invoices.id, invoiceId), eq(invoices.shopId, shopId))).for("update");
    if (!invoice) throw new ShopError("AK_INVOICE_UNKNOWN");
    if (invoice.creditOf) throw new ShopError("AK_PAYMENT_ON_CREDIT_NOTE");
    const [{ paid } = { paid: 0 }] = await tx.select({ paid: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int` }).from(payments).where(eq(payments.invoiceId, invoiceId));
    if (paid + input.amountCents > invoice.totalCents) throw new ShopError("AK_OVERPAYMENT");
    const [row] = await tx.insert(payments).values({ invoiceId, method: input.method, amountCents: input.amountCents, receivedAt: now }).returning({ id: payments.id });
    const paidCents = paid + input.amountCents;
    return { paymentId: row!.id, totalCents: invoice.totalCents, paidCents, paid: paidCents === invoice.totalCents, becamePaid: paid < invoice.totalCents && paidCents === invoice.totalCents };
  });
}

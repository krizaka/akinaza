import { applyRate, type Cents, type Rate } from "./money";

/**
 * Québec sales taxes, as a shop charges them: GST 5 % (federal, CRA) and QST 9.975 % (Revenu Québec), both on the same
 * taxable base (since 2013 the QST is no longer charged on the GST). Each is computed **once per invoice** on the sum of
 * its taxable lines and rounded to the cent — not line by line, which drifts by a cent on long invoices.
 */
export const GST: Rate = { numerator: 5, denominator: 100 };
export const QST: Rate = { numerator: 9975, denominator: 100_000 };

/** standard: taxable at both rates · zeroRated: taxable at 0 % (basic groceries — a bakery's bread) · exempt: outside the taxes. */
export type TaxCategory = "standard" | "zeroRated" | "exempt";

export interface LineInput {
  description: string;
  quantity: number;
  unitPriceCents: Cents;
  discountCents?: Cents;
  category: TaxCategory;
}

export interface Line extends LineInput {
  amountCents: Cents;
}

export interface InvoiceTotals {
  lines: Line[];
  /** Taxable at 5 % / 9.975 %. */
  taxableCents: Cents;
  zeroRatedCents: Cents;
  exemptCents: Cents;
  subtotalCents: Cents;
  gstCents: Cents;
  qstCents: Cents;
  totalCents: Cents;
}

/**
 * The totals of an invoice. A shop that is not registered (a small supplier, under $30 000 of taxable sales over four
 * quarters) charges no tax at all — and its invoice carries no tax number.
 */
export function invoiceTotals(input: readonly LineInput[], shop: { registrant: boolean }): InvoiceTotals {
  const lines = input.map((l) => {
    if (!Number.isInteger(l.quantity) || l.quantity === 0) throw new RangeError(`quantity must be a non-zero whole number: ${l.quantity}`);
    if (!Number.isSafeInteger(l.unitPriceCents) || !Number.isSafeInteger(l.discountCents ?? 0)) throw new RangeError("amounts are whole cents");
    return { ...l, amountCents: l.quantity * l.unitPriceCents - (l.discountCents ?? 0) };
  });
  const sum = (c: TaxCategory) => lines.filter((l) => l.category === c).reduce((s, l) => s + l.amountCents, 0);
  const taxableCents = sum("standard");
  const zeroRatedCents = sum("zeroRated");
  const exemptCents = sum("exempt");
  const subtotalCents = taxableCents + zeroRatedCents + exemptCents;
  const gstCents = shop.registrant ? applyRate(taxableCents, GST) : 0;
  const qstCents = shop.registrant ? applyRate(taxableCents, QST) : 0;
  return { lines, taxableCents, zeroRatedCents, exemptCents, subtotalCents, gstCents, qstCents, totalCents: subtotalCents + gstCents + qstCents };
}

/** A GST/HST registration number (9 digits + RT + 4 digits) and a QST number (10 digits + TQ + 4 digits). */
export const GST_NUMBER = /^\d{9}RT\d{4}$/;
export const QST_NUMBER = /^\d{10}TQ\d{4}$/;

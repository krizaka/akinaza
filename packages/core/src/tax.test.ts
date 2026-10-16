import { describe, expect, it } from "vitest";

import { applyRate, formatCents, parseCents } from "./money";
import { GST, GST_NUMBER, invoiceTotals, QST, QST_NUMBER } from "./tax";

const standard = (unitPriceCents: number, quantity = 1) => ({ description: "x", quantity, unitPriceCents, category: "standard" as const });

describe("money in whole cents", () => {
  it("rounds half away from zero, exactly, without floats", () => {
    expect(applyRate(10_000, QST)).toBe(998); // 997.5 → 998
    expect(applyRate(1_999, QST)).toBe(199); // 199.40025 → 199
    expect(applyRate(1_999, GST)).toBe(100); // 99.95 → 100
    expect(applyRate(-10_000, QST)).toBe(-998); // a credit note mirrors its invoice
    expect(applyRate(Number.MAX_SAFE_INTEGER, QST)).toBeGreaterThan(0);
    expect(() => applyRate(10.5, GST)).toThrow();
  });
  it("parses and prints amounts, refusing what is not money", () => {
    expect(parseCents("19.99")).toBe(1999);
    expect(parseCents("19,9")).toBe(1990);
    expect(parseCents("-3")).toBe(-300);
    expect(parseCents("1 250,50")).toBe(125050);
    expect(parseCents("10 000 $")).toBe(1000000);
    expect(parseCents("1 234,50 $")).toBe(123450);
    expect(parseCents("1\u00A0234,50 $")).toBe(123450);
    expect(parseCents("1\u202F234,50 $")).toBe(123450);
    expect(() => parseCents("1.999")).toThrow();
    expect(formatCents(-1999)).toBe("-19.99");
  });
});

describe("GST 5 % and QST 9.975 % on known invoices", () => {
  it.each([
    // [lines, subtotal, GST, QST, total] — checked by hand against the official rates
    [[standard(10_000)], 10_000, 500, 998, 11_498],
    [[standard(1_000)], 1_000, 50, 100, 1_150],
    [[standard(100)], 100, 5, 10, 115],
    [[standard(1_999)], 1_999, 100, 199, 2_298],
    [[standard(4_500), standard(2_500), standard(1_250)], 8_250, 413, 823, 9_486],
    [[standard(333, 3)], 999, 50, 100, 1_149],
  ])("%j", (lines, subtotal, gst, qst, total) => {
    const t = invoiceTotals(lines, { registrant: true });
    expect([t.subtotalCents, t.gstCents, t.qstCents, t.totalCents]).toEqual([subtotal, gst, qst, total]);
    expect(t.totalCents).toBe(t.subtotalCents + t.gstCents + t.qstCents);
  });

  it("taxes the invoice once, not line by line (no drift of a cent)", () => {
    const lines = Array.from({ length: 3 }, () => standard(1_005));
    const perLine = lines.reduce((s, l) => s + applyRate(l.unitPriceCents, QST), 0);
    expect(perLine).toBe(300); // 100.25 → 100, three times
    expect(invoiceTotals(lines, { registrant: true }).qstCents).toBe(301); // 300.75 → 301 on the sum
  });

  it("charges nothing on zero-rated bread or an exempt line, and nothing at all for a small supplier", () => {
    const bakery = invoiceTotals([{ description: "Pain de campagne", quantity: 2, unitPriceCents: 650, category: "zeroRated" }, { description: "Café", quantity: 1, unitPriceCents: 350, category: "standard" }], { registrant: true });
    expect(bakery).toMatchObject({ taxableCents: 350, zeroRatedCents: 1_300, subtotalCents: 1_650, gstCents: 18, qstCents: 35, totalCents: 1_703 });
    expect(invoiceTotals([standard(10_000)], { registrant: false })).toMatchObject({ gstCents: 0, qstCents: 0, totalCents: 10_000 });
  });

  it("applies a discount before the taxes, refuses fractional cents or quantities", () => {
    expect(invoiceTotals([{ ...standard(5_000), discountCents: 1_000 }], { registrant: true })).toMatchObject({ subtotalCents: 4_000, gstCents: 200, qstCents: 399 });
    expect(() => invoiceTotals([standard(10.5)], { registrant: true })).toThrow();
    expect(() => invoiceTotals([standard(100, 1.5)], { registrant: true })).toThrow();
    expect(() => invoiceTotals([{ ...standard(5_000), discountCents: -100 }], { registrant: true })).toThrow();
    expect(() => invoiceTotals([{ ...standard(5_000), discountCents: 6_000 }], { registrant: true })).toThrow();
  });

  it("knows the shape of the registration numbers", () => {
    expect(GST_NUMBER.test("123456789RT0001")).toBe(true);
    expect(QST_NUMBER.test("1234567890TQ0001")).toBe(true);
    expect(QST_NUMBER.test("123456789RT0001")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { RETENTION_RULES, retentionOf, TAX_RETENTION_YEARS, taxRetentionEnd } from "./retention";

describe("retention rules as data (akinaza#370)", () => {
  it("keeps tax records six years after the end of the year, cited by name and article", () => {
    expect(TAX_RETENTION_YEARS).toBe(6);
    for (const id of ["invoices", "tax-ledger"]) {
      const rule = RETENTION_RULES.find((r) => r.id === id)!;
      expect(rule.keep).toBe("tax");
      expect(rule.onErasure).toBe("kept-anonymised");
      expect(rule.basis!.some((b) => /A-6\.002, art\. 35/.test(b))).toBe(true);
    }
  });

  it("computes the last day: the end of the sixth year after the record's year", () => {
    expect(taxRetentionEnd("2026-10-26")).toBe("2032-12-31");
    expect(taxRetentionEnd("2026-01-01")).toBe("2032-12-31");
    expect(() => taxRetentionEnd("26-10-26")).toThrow(RangeError);
  });

  it("names a table once", () => {
    const all = RETENTION_RULES.flatMap((r) => r.tables);
    expect(new Set(all).size).toBe(all.length);
    expect(retentionOf("invoices")?.id).toBe("invoices");
    expect(retentionOf("nothing")).toBeUndefined();
  });

  it("never pastes a statute's text: a basis is a name and an article", () => {
    for (const basis of RETENTION_RULES.flatMap((r) => r.basis ?? [])) expect(basis.length).toBeLessThan(90);
  });
});

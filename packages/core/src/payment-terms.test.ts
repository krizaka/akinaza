import { describe, expect, it } from "vitest";

import { dueOn, PAYMENT_TERMS_CHOICES, termsDaysSchema } from "./payment-terms";

describe("the due date of an invoice", () => {
  it("is the issue date plus the terms, in calendar days", () => {
    expect(dueOn("2026-10-21", 30)).toBe("2026-11-20");
    expect(dueOn("2026-10-21", 15)).toBe("2026-11-05");
    expect(dueOn("2026-12-20", 30)).toBe("2027-01-19");
  });

  it("crosses a month end and a leap day", () => {
    expect(dueOn("2028-01-31", 30)).toBe("2028-03-01");
    expect(dueOn("2027-01-31", 30)).toBe("2027-03-02");
    expect(dueOn("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("is the issue date itself when the invoice is due on receipt", () => {
    expect(dueOn("2026-10-21", 0)).toBe("2026-10-21");
  });

  it("refuses terms that are not whole days between 0 and 365", () => {
    for (const bad of [-1, 366, 1.5, Number.NaN]) expect(termsDaysSchema.safeParse(bad).success, String(bad)).toBe(false);
    expect(() => dueOn("2026-10-21", 400)).toThrow();
  });

  it("offers the usual terms, all valid", () => {
    expect([...PAYMENT_TERMS_CHOICES]).toEqual([0, 15, 30, 45, 60]);
    for (const days of PAYMENT_TERMS_CHOICES) expect(termsDaysSchema.safeParse(days).success).toBe(true);
  });
});

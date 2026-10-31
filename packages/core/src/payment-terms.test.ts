import { describe, expect, it } from "vitest";

import { dueOn, isPastDue, PAYMENT_TERMS_CHOICES, termsChoices, termsDaysSchema } from "./payment-terms";

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

describe("what is overdue", () => {
  it("is a due day strictly before the shop's today, never the day itself", () => {
    expect(isPastDue("2026-10-30", "2026-10-31")).toBe(true);
    expect(isPastDue("2026-10-31", "2026-10-31")).toBe(false);
    expect(isPastDue("2026-11-01", "2026-10-31")).toBe(false);
    expect(isPastDue(null, "2026-10-31")).toBe(false);
  });

  it("reads calendar days, so a month end and a year end compare as dates", () => {
    expect(isPastDue(dueOn("2026-07-31", 30), "2026-08-30")).toBe(false);
    expect(isPastDue(dueOn("2026-07-31", 30), "2026-08-31")).toBe(true);
    expect(isPastDue(dueOn("2026-12-15", 30), "2027-01-14")).toBe(false);
    expect(isPastDue(dueOn("2026-12-15", 30), "2027-01-15")).toBe(true);
  });

  it("follows the shop's day, not the server's: 23:30 in Montréal is already tomorrow in UTC", () => {
    const due = dueOn("2026-10-01", 30); // 2026-10-31
    const at = new Date("2026-11-01T03:30:00Z"); // 23:30 on 31 Oct in Montréal (EDT until the clocks change at 06:00Z)
    const day = (tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
    expect(day("America/Toronto")).toBe("2026-10-31");
    expect(day("UTC")).toBe("2026-11-01");
    expect(isPastDue(due, day("America/Toronto"))).toBe(false);
    expect(isPastDue(due, day("UTC"))).toBe(true);
  });

  it("offers the shop's own terms among the usual ones, once, in order", () => {
    expect(termsChoices(30)).toEqual([0, 15, 30, 45, 60]);
    expect(termsChoices(20)).toEqual([0, 15, 20, 30, 45, 60]);
    expect(() => termsChoices(400)).toThrow();
  });
});

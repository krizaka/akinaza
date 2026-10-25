import { describe, expect, it } from "vitest";

import { formatDate, formatLongDay, formatMoney, formatMonth, formatTime } from "./format";

describe("format", () => {
  it("writes money in Canadian dollars, in the language's habit", () => {
    expect(formatMoney(12_345, "en").replace(/\s/g, " ")).toBe("$123.45");
    expect(formatMoney(12_345, "fr").replace(/\s/g, " ")).toBe("123,45 $");
    expect(formatMoney(123_456_789, "fr").replace(/\s/g, " ")).toBe("1 234 567,89 $");
  });

  it("takes integer cents, never a float: the ledger's money through @krizaka/intl (« Krizaka first »)", () => {
    expect(() => formatMoney(12.5, "fr")).toThrow(TypeError);
  });

  it("names a day in full whatever the machine's zone, and a time in the shop's zone", () => {
    expect(formatLongDay("2026-10-22", "en")).toBe("Thursday, October 22, 2026");
    expect(formatLongDay("2026-10-22", "fr")).toBe("jeudi 22 octobre 2026");
    expect(formatTime("2026-10-22T14:30:00Z", "en", "America/Toronto")).toMatch(/10:30/);
  });

  it("dates an instant on the shop's calendar, not the machine's", () => {
    expect(formatDate("2026-10-23T02:00:00Z", "en", "America/Toronto")).toBe("Oct 22, 2026");
  });

  it("names the month an account was opened in Montréal, not in UTC", () => {
    expect(formatMonth("2026-11-01T02:00:00Z", "en", "America/Montreal")).toBe("October 2026");
    expect(formatMonth("2026-11-01T02:00:00Z", "fr", "America/Montreal")).toBe("octobre 2026");
  });
});

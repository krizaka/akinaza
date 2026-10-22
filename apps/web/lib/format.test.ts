import { describe, expect, it } from "vitest";

import { formatDate, formatLongDay, formatMoney, formatTime } from "./format";

describe("format", () => {
  it("writes money in Canadian dollars, in the language's habit", () => {
    expect(formatMoney(12_345, "en").replace(/\s/g, " ")).toBe("$123.45");
    expect(formatMoney(12_345, "fr").replace(/\s/g, " ")).toBe("123,45 $");
  });

  it("names a day in full whatever the machine's zone, and a time in the shop's zone", () => {
    expect(formatLongDay("2026-10-22", "en")).toBe("Thursday, October 22, 2026");
    expect(formatLongDay("2026-10-22", "fr")).toBe("jeudi 22 octobre 2026");
    expect(formatTime("2026-10-22T14:30:00Z", "en", "America/Toronto")).toMatch(/10:30/);
  });

  it("dates an instant on the shop's calendar, not the machine's", () => {
    expect(formatDate("2026-10-23T02:00:00Z", "en", "America/Toronto")).toBe("Oct 22, 2026");
  });
});

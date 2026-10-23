import { describe, expect, it } from "vitest";

import { timeOffDays, timeOffRanges } from "./time-off";

describe("time off as ranges (akinaza#208)", () => {
  it("a range is every day, both ends included, across a month", () => {
    expect(timeOffDays({ from: "2026-10-30", to: "2026-11-02" })).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(timeOffDays({ from: "2026-12-24", to: "2026-12-24" })).toEqual(["2026-12-24"]);
  });

  it("a reversed, malformed or too long range is refused", () => {
    expect(() => timeOffDays({ from: "2026-10-27", to: "2026-10-20" })).toThrow("AK_TIME_OFF_ORDER");
    expect(() => timeOffDays({ from: "27/10", to: "2026-10-20" })).toThrow("AK_TIME_OFF_DATE");
    expect(() => timeOffDays({ from: "2026-01-01", to: "2026-12-31" })).toThrow("AK_TIME_OFF_TOO_LONG");
  });

  it("days come back as ranges: consecutive ones join, overlaps merge, gaps split", () => {
    const days = [...timeOffDays({ from: "2026-10-20", to: "2026-10-23" }), ...timeOffDays({ from: "2026-10-22", to: "2026-10-27" }), "2026-12-24"];
    expect(timeOffRanges(days)).toEqual([
      { from: "2026-10-20", to: "2026-10-27" },
      { from: "2026-12-24", to: "2026-12-24" },
    ]);
    expect(timeOffRanges([])).toEqual([]);
  });
});

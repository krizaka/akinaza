import { isMonth, monthOf, monthRange, shiftMonth } from "./month";

describe("the calendar's month", () => {
  it.each([
    ["2026-10", "2026-10-01", "2026-10-31"],
    ["2026-02", "2026-02-01", "2026-02-28"],
    ["2028-02", "2028-02-01", "2028-02-29"],
    ["2026-11", "2026-11-01", "2026-11-30"],
  ])("%s runs from %s to %s", (month, from, to) => expect(monthRange(month)).toEqual({ from, to }));

  it("moves by months across a year", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-10", 0)).toBe("2026-10");
  });

  it("reads a month from a day and refuses what is not one", () => {
    expect(monthOf("2026-10-20")).toBe("2026-10");
    expect([isMonth("2026-10"), isMonth("2026-13"), isMonth("2026-1"), isMonth(undefined)]).toEqual([true, false, false, false]);
    expect(() => monthRange("nope")).toThrow(RangeError);
  });
});

import { describe, expect, it } from "vitest";

import { groupByPart, hourIn, mondayOf, partOfHour, weekDays } from "./slot-weeks";

describe("the weeks and the parts of the day of the booking pages", () => {
  it("starts a week on its Monday, a Sunday belonging to the week before", () => {
    expect(mondayOf("2026-10-21")).toBe("2026-10-19");
    expect(mondayOf("2026-10-19")).toBe("2026-10-19");
    expect(mondayOf("2026-10-25")).toBe("2026-10-19");
    expect(mondayOf("2026-10-26")).toBe("2026-10-26");
    expect(weekDays("2026-10-26")).toEqual(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]);
  });

  it("reads the hour on the shop's clock, not the server's", () => {
    expect(hourIn(new Date("2026-10-20T13:30:00Z"), "America/Toronto")).toBe(9);
    expect(hourIn(new Date("2026-10-21T03:30:00Z"), "America/Toronto")).toBe(23);
    expect(hourIn(new Date("2026-10-20T04:00:00Z"), "America/Toronto")).toBe(0);
  });

  it("cuts the day at noon and at 17 h, and leaves the empty parts out", () => {
    expect([11, 12, 16, 17].map(partOfHour)).toEqual(["morning", "afternoon", "afternoon", "evening"]);
    expect(groupByPart([9, 10, 18], (h) => h)).toEqual([{ part: "morning", items: [9, 10] }, { part: "evening", items: [18] }]);
  });
});

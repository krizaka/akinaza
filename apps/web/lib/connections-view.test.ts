import { canonicalHours } from "@akinaza/core";
import { describe, expect, it } from "vitest";

import { hoursLines, valueLines } from "./connections-view";

const week = (days: number[], startsAt: string, endsAt: string) => days.map((weekday) => ({ weekday, startsAt, endsAt }));

describe("the hours as lines", () => {
  it("groups consecutive days that share the same hours", () => {
    const hours = canonicalHours([...week([1, 2, 3, 4, 5], "09:00", "17:00"), ...week([6], "10:00", "13:00")]);
    expect(hoursLines(hours, "en")).toEqual(["Mon–Fri 09:00–17:00", "Sat 10:00–13:00"]);
    expect(hoursLines(hours, "fr")[0]).toMatch(/^lun\.?–ven\.? 09:00–17:00$/);
  });
  it("keeps Sunday last and a split day on one line", () => {
    const hours = canonicalHours([...week([0], "10:00", "12:00"), ...week([1], "09:00", "12:00"), ...week([1], "13:00", "17:00")]);
    expect(hoursLines(hours, "en")).toEqual(["Mon 09:00–12:00, 13:00–17:00", "Sun 10:00–12:00"]);
  });
  it("says nothing for empty values", () => {
    expect(valueLines("hours", {}, "en")).toBeNull();
    expect(valueLines("phone", " ", "en")).toBeNull();
    expect(valueLines("phone", "514", "en")).toEqual(["514"]);
  });
});

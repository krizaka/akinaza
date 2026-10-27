import { describe, expect, it } from "vitest";

import { applyOwnerOverrides, DEFAULT_FIGURE_THRESHOLDS, OWNER_BOUNDS, OWNER_TUNABLE, parseOwnerOverrides } from "./thresholds";

describe("the owner's thresholds (#260)", () => {
  it("keeps only tunable whole numbers inside the bounds", () => {
    expect(parseOwnerOverrides({ overdueWatchPct: 15, collectedWatchPct: 0, marginWatchPct: 12.5, maxActions: 9, noShowWatchPct: "7", taxPeriodSoonDays: 61 })).toEqual({ overdueWatchPct: 15 });
    expect(parseOwnerOverrides(null)).toEqual({});
    expect(parseOwnerOverrides([1])).toEqual({});
  });

  it("puts the owner's value over the administrator's default and leaves the rest alone", () => {
    const t = applyOwnerOverrides(DEFAULT_FIGURE_THRESHOLDS, { overdueWatchPct: 5, taxPeriodSoonDays: 30 });
    expect(t.overdueWatchPct).toBe(5);
    expect(t.taxPeriodSoonDays).toBe(30);
    expect(t.marginWatchPct).toBe(DEFAULT_FIGURE_THRESHOLDS.marginWatchPct);
    expect(t.maxActions).toBe(DEFAULT_FIGURE_THRESHOLDS.maxActions);
  });

  it("never lets an alert be gentler than its watch, whatever the owner typed", () => {
    expect(applyOwnerOverrides(DEFAULT_FIGURE_THRESHOLDS, { overdueWatchPct: 40 }).overdueAlertPct).toBe(40);
    expect(applyOwnerOverrides(DEFAULT_FIGURE_THRESHOLDS, { collectedWatchPct: 50 }).collectedAlertPct).toBe(50);
  });

  it("has a bound for every tunable key and none for the others", () => {
    expect(Object.keys(OWNER_BOUNDS).sort()).toEqual([...OWNER_TUNABLE].sort());
  });
});

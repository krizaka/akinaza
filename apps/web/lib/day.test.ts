import { describe, expect, it } from "vitest";

import { AppointmentStatus, daySummary, dayView, isIsoDay, shiftDay, stripWindow } from "./day";

const at = (id: string, hour: number, status: AppointmentStatus, priceCents = 10_000, category: "standard" | "exempt" = "standard") => ({
  id,
  startsAt: `2026-10-22T${String(hour).padStart(2, "0")}:00:00Z`,
  status,
  client: `Client ${id}`,
  priceCents,
  category,
});

describe("days", () => {
  it.each([
    ["2026-10-22", true],
    ["2026-02-30", false],
    ["22-10-2026", false],
    ["", false],
    [undefined, false],
  ])("isIsoDay(%s) is %s", (value, expected) => expect(isIsoDay(value)).toBe(expected));

  it.each([
    ["2026-10-22", 1, "2026-10-23"],
    ["2026-10-31", 1, "2026-11-01"],
    ["2026-03-01", -1, "2026-02-28"],
  ])("shiftDay(%s, %i) is %s", (day, by, expected) => expect(shiftDay(day, by)).toBe(expected));

  it("keeps the strip on today while the chosen day is inside it, and follows the chosen day outside", () => {
    expect(stripWindow("2026-10-22", "2026-10-22").start).toBe("2026-10-19");
    expect(stripWindow("2026-10-30", "2026-10-22").start).toBe("2026-10-19");
    expect(stripWindow("2026-12-01", "2026-10-22").start).toBe("2026-11-28");
  });
});

describe("daySummary", () => {
  const now = new Date("2026-10-22T10:30:00Z");
  const day = [at("a", 9, "done"), at("b", 11, "booked"), at("c", 12, "cancelled"), at("d", 14, "booked", 5_000, "exempt"), at("e", 15, "noShow")];

  it("counts the booked and the done, and bills them with GST and QST for a registrant", () => {
    const summary = daySummary(day, true, now);
    expect(summary.count).toBe(3);
    // 20 000 taxable: 5 % = 1 000, 9.975 % = 1 995; plus 5 000 exempt.
    expect(summary.expectedCents).toBe(20_000 + 5_000 + 1_000 + 1_995);
  });

  it("charges no tax to a small supplier", () => {
    expect(daySummary(day, false, now).expectedCents).toBe(25_000);
  });

  it("names the next client: the first booked appointment still to come", () => {
    expect(daySummary(day, true, now).next).toEqual({ id: "b", client: "Client b", startsAt: "2026-10-22T11:00:00Z" });
    expect(daySummary(day, true, new Date("2026-10-22T20:00:00Z")).next).toBeNull();
  });

  it("is empty on a free day", () => {
    expect(daySummary([], true, now)).toEqual({ count: 0, expectedCents: 0, next: null });
  });
});

describe("who reads the day how (docs/ux/2026-10-full-review.md B1)", () => {
  it("gives the owner and a manager the agenda in every trade, and a dog walker's staff their cards", () => {
    expect(dayView("owner", true)).toBe("agenda");
    expect(dayView("manager", true)).toBe("agenda");
    expect(dayView("owner", false)).toBe("agenda");
    expect(dayView("staff", true)).toBe("cards");
    expect(dayView("staff", false)).toBe("agenda");
  });
});

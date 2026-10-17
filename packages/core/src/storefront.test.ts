import { describe, expect, it } from "vitest";

import { bookingPreselect, groupSlotsByDay, openSlots, openStatus, popularServiceId, type SlotRequest, weekSchedule } from "./index";

const TZ = "America/Toronto";
// Monday–Friday 08:00–12:00 and 13:00–17:00, Saturday 09:00–12:00 (the dog walker's week).
const WALKER = [
  ...[1, 2, 3, 4, 5].flatMap((weekday) => [
    { weekday, startsAt: "08:00", endsAt: "12:00" },
    { weekday, startsAt: "13:00", endsAt: "17:00" },
  ]),
  { weekday: 6, startsAt: "09:00", endsAt: "12:00" },
];
// 2026-10-19 is a Monday; Montréal is on EDT (UTC-4) until 2026-11-01.
const at = (local: string) => new Date(`${local}:00-04:00`);

describe("openStatus — open now, from the hours", () => {
  it("is open inside a window and says when it closes", () => {
    expect(openStatus(WALKER, at("2026-10-19T10:30"), TZ)).toMatchObject({ open: true, closesAt: "12:00", nextOpen: null });
    expect(openStatus(WALKER, at("2026-10-19T13:00"), TZ)).toMatchObject({ open: true, closesAt: "17:00" });
  });
  it("is closed at the end of a window (the end is not open) and over the lunch break, with the next opening today", () => {
    expect(openStatus(WALKER, at("2026-10-19T12:00"), TZ)).toEqual({ open: false, closesAt: null, nextOpen: { day: "2026-10-19", weekday: 1, time: "13:00", today: true, tomorrow: false } });
    expect(openStatus(WALKER, at("2026-10-19T07:59"), TZ).nextOpen).toMatchObject({ time: "08:00", today: true });
  });
  it("after the last window of the day, opens tomorrow; on Saturday afternoon, opens Monday", () => {
    expect(openStatus(WALKER, at("2026-10-19T17:00"), TZ).nextOpen).toEqual({ day: "2026-10-20", weekday: 2, time: "08:00", today: false, tomorrow: true });
    expect(openStatus(WALKER, at("2026-10-24T12:30"), TZ).nextOpen).toEqual({ day: "2026-10-26", weekday: 1, time: "08:00", today: false, tomorrow: false });
  });
  it("reads the clock in the shop's zone, not the server's", () => {
    // 14:30Z on Monday is 10:30 in Montréal; in UTC+9 it would already be Tuesday night.
    expect(openStatus(WALKER, new Date("2026-10-19T14:30:00Z"), TZ).open).toBe(true);
    expect(openStatus(WALKER, new Date("2026-10-19T14:30:00Z"), "Asia/Tokyo").open).toBe(false);
  });
  it("is closed on a day off and finds the next open day", () => {
    const s = openStatus(WALKER, at("2026-10-19T10:30"), TZ, ["2026-10-19"]);
    expect(s.open).toBe(false);
    expect(s.nextOpen).toMatchObject({ day: "2026-10-20", time: "08:00", tomorrow: true });
  });
  it("treats back-to-back windows as one and closes at the end of the run", () => {
    const run = [{ weekday: 1, startsAt: "09:00", endsAt: "12:00" }, { weekday: 1, startsAt: "12:00", endsAt: "18:00" }];
    expect(openStatus(run, at("2026-10-19T11:00"), TZ)).toMatchObject({ open: true, closesAt: "18:00" });
  });
  it("has no next opening for a shop without hours", () => {
    expect(openStatus([], at("2026-10-19T10:00"), TZ)).toEqual({ open: false, closesAt: null, nextOpen: null });
  });
});

describe("weekSchedule — the compact hours", () => {
  it("lists Monday to Sunday, the windows of each day in order, closed days empty", () => {
    const week = weekSchedule([{ weekday: 1, startsAt: "13:00", endsAt: "17:00" }, { weekday: 1, startsAt: "08:00", endsAt: "12:00" }, { weekday: 0, startsAt: "10:00", endsAt: "14:00" }]);
    expect(week.map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(week[0]!.windows).toEqual([{ startsAt: "08:00", endsAt: "12:00" }, { startsAt: "13:00", endsAt: "17:00" }]);
    expect(week[1]!.windows).toEqual([]);
    expect(week[6]!.windows).toEqual([{ startsAt: "10:00", endsAt: "14:00" }]);
  });
  it("cuts the seconds a database time carries", () => {
    expect(weekSchedule([{ weekday: 2, startsAt: "08:00:00", endsAt: "12:00:00" }])[1]!.windows).toEqual([{ startsAt: "08:00", endsAt: "12:00" }]);
  });
});

describe("groupSlotsByDay — the real availability as chips", () => {
  const request: SlotRequest = {
    timezone: TZ,
    now: at("2026-10-19T07:00"),
    fromDay: "2026-10-19",
    days: 3,
    windows: [{ weekday: 1, startsAt: "09:00", endsAt: "11:00" }, { weekday: 2, startsAt: "09:00", endsAt: "10:00" }, { weekday: 3, startsAt: "09:00", endsAt: "10:00" }],
    daysOff: [],
    serviceId: "walk",
    zoneId: null,
    durationMinutes: 60,
    stepMinutes: 30,
    capacity: 1,
    minNoticeMinutes: 60,
    visits: [],
  };
  it("groups the offered slots by the shop's local day, in order", () => {
    const days = groupSlotsByDay(openSlots(request), TZ, { maxDays: 7, maxPerDay: 8 });
    expect(days.map((d) => [d.day, d.slots.length])).toEqual([["2026-10-19", 3], ["2026-10-20", 1], ["2026-10-21", 1]]);
  });
  it("leaves out a time that is taken: what is booked is not offered", () => {
    const taken = { startsAt: at("2026-10-19T10:00"), endsAt: at("2026-10-19T11:00"), serviceId: "other", zoneId: null, seatsTaken: 1 };
    const days = groupSlotsByDay(openSlots({ ...request, visits: [taken] }), TZ, { maxDays: 7, maxPerDay: 8 });
    expect(days[0]!.slots.map((s) => s.startsAt.toISOString())).toEqual(["2026-10-19T13:00:00.000Z"]);
  });
  it("keeps the first days and the first times only", () => {
    const days = groupSlotsByDay(openSlots(request), TZ, { maxDays: 2, maxPerDay: 2 });
    expect(days).toHaveLength(2);
    expect(days[0]!.slots).toHaveLength(2);
  });
  it("is empty when nothing is free", () => {
    expect(groupSlotsByDay([], TZ, { maxDays: 7, maxPerDay: 8 })).toEqual([]);
  });
});

describe("popularServiceId — « Popular » only from real bookings", () => {
  it("names the most booked service when it clearly leads", () => {
    expect(popularServiceId([{ serviceId: "a", bookings: 9 }, { serviceId: "b", bookings: 4 }])).toBe("a");
  });
  it("names none without bookings, below the minimum, on a tie, or when it is the only service", () => {
    expect(popularServiceId([])).toBeNull();
    expect(popularServiceId([{ serviceId: "a", bookings: 2 }, { serviceId: "b", bookings: 0 }])).toBeNull();
    expect(popularServiceId([{ serviceId: "a", bookings: 5 }, { serviceId: "b", bookings: 5 }])).toBeNull();
    expect(popularServiceId([{ serviceId: "a", bookings: 8 }])).toBeNull();
  });
});

describe("bookingPreselect — a service chosen on the page opens the booking with it", () => {
  const services = [{ id: "s1" }, { id: "s2" }];
  const zones = [{ id: "z1" }];
  it("keeps the service, the zone and the time that exist", () => {
    expect(bookingPreselect({ service: "s2", zone: "z1", start: "2026-10-20T13:00:00Z" }, services, zones)).toEqual({ serviceId: "s2", zoneId: "z1", startsAt: "2026-10-20T13:00:00.000Z" });
  });
  it("drops what the shop does not offer or what is not a time", () => {
    expect(bookingPreselect({ service: "nope", zone: "elsewhere", start: "tomorrow" }, services, zones)).toEqual({ serviceId: null, zoneId: null, startsAt: null });
    expect(bookingPreselect({}, services, zones)).toEqual({ serviceId: null, zoneId: null, startsAt: null });
  });
  it("never keeps a time without its service", () => {
    expect(bookingPreselect({ start: "2026-10-20T13:00:00Z" }, services, zones).startsAt).toBeNull();
  });
});

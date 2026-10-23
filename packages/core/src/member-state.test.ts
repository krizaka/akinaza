import { describe, expect, it } from "vitest";

import { memberStateAt } from "./storefront";

/** Montréal, Monday 2026-10-19 (EDT, UTC−4): 09:00–12:00 and 13:00–17:00. */
const TZ = "America/Toronto";
const at = (clock: string) => new Date(`2026-10-19T${clock}:00-04:00`);
const windows = [
  { weekday: 1, startsAt: "09:00", endsAt: "12:00" },
  { weekday: 1, startsAt: "13:00", endsAt: "17:00" },
];
const visit = (from: string, to: string) => ({ startsAt: at(from), endsAt: at(to) });
const day = { windows, visits: [visit("10:00", "10:45"), visit("10:45", "11:30"), visit("14:00", "15:00")], offUntil: null };

describe("where a member of the team stands, for the public page (akinaza#209)", () => {
  it("before opening, they start at the first window", () => {
    expect(memberStateAt(day, at("08:10"), TZ)).toEqual({ kind: "startsAt", time: "09:00" });
  });

  it("in a window with no visit under way, free", () => {
    expect(memberStateAt(day, at("09:30"), TZ)).toEqual({ kind: "free" });
    expect(memberStateAt(day, at("11:30"), TZ)).toEqual({ kind: "free" });
  });

  it("during a visit, busy until the end of the visits that follow without a gap", () => {
    expect(memberStateAt(day, at("10:15"), TZ)).toEqual({ kind: "busy", until: "11:30" });
    expect(memberStateAt(day, at("14:30"), TZ)).toEqual({ kind: "busy", until: "15:00" });
  });

  it("at lunch, back at the next window; after closing, done; a day without hours, away", () => {
    expect(memberStateAt(day, at("12:20"), TZ)).toEqual({ kind: "startsAt", time: "13:00" });
    expect(memberStateAt(day, at("17:00"), TZ)).toEqual({ kind: "done" });
    expect(memberStateAt({ ...day, windows: [{ weekday: 2, startsAt: "09:00", endsAt: "17:00" }] }, at("10:15"), TZ)).toEqual({ kind: "away" });
  });

  it("on time off, until its last day — whatever the hours say", () => {
    expect(memberStateAt({ ...day, offUntil: "2026-10-27" }, at("10:15"), TZ)).toEqual({ kind: "off", until: "2026-10-27" });
  });

  it("a visit running past the window's end says the window's end", () => {
    expect(memberStateAt({ ...day, visits: [visit("16:30", "17:40")] }, at("16:45"), TZ)).toEqual({ kind: "busy", until: "17:00" });
  });
});

import { TZDate } from "@date-fns/tz";
import { compareAsc } from "date-fns";
import { z } from "zod";

import { addLocalDays, localDay, type Slot, weekdayOf, type WeeklyWindow } from "./service-shop";

/**
 * What a shop's public page is computed from (ADR-001): open now from the weekly hours, the compact week, the next free
 * times grouped by day, « Popular » from real bookings, and a service chosen on the page carried into the booking. Pure
 * and deterministic: the clock and the shop's time zone are parameters.
 */

const clock = (value: string) => value.slice(0, 5);
const minutesOf = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));

/** A shop's windows of one weekday, in order, back-to-back ones merged (08–12 then 12–17 is one run to 17). */
function runsOf(windows: readonly WeeklyWindow[], weekday: number): { startsAt: string; endsAt: string }[] {
  const sorted = windows.filter((w) => w.weekday === weekday).map((w) => ({ startsAt: clock(w.startsAt), endsAt: clock(w.endsAt) })).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const runs: { startsAt: string; endsAt: string }[] = [];
  for (const w of sorted) {
    const last = runs[runs.length - 1];
    if (last && minutesOf(w.startsAt) <= minutesOf(last.endsAt)) last.endsAt = minutesOf(w.endsAt) > minutesOf(last.endsAt) ? w.endsAt : last.endsAt;
    else runs.push({ ...w });
  }
  return runs;
}

export interface NextOpening {
  /** The local day, `YYYY-MM-DD`. */
  day: string;
  weekday: number;
  /** `HH:MM`, the shop's local time. */
  time: string;
  today: boolean;
  tomorrow: boolean;
}

export interface OpenStatus {
  open: boolean;
  /** `HH:MM`: when the current run of hours ends; null when closed. */
  closesAt: string | null;
  /** When it opens next; null when open, or when the shop has no hours in the next two weeks. */
  nextOpen: NextOpening | null;
}

/** Whether the shop is open at `now`, in its own time zone, and when it closes or opens next. The end of a window is closed. */
export function openStatus(windows: readonly WeeklyWindow[], now: Date, timezone: string, daysOff: readonly string[] = []): OpenStatus {
  const today = localDay(now, timezone);
  const local = new TZDate(now, timezone);
  const minutes = local.getHours() * 60 + local.getMinutes();
  // @fixed: how far ahead « opens on… » looks — two weeks covers any weekly pattern with its days off.
  const lookAheadDays = 14;
  for (let i = 0; i <= lookAheadDays; i++) {
    const day = addLocalDays(today, i);
    if (daysOff.includes(day)) continue;
    const weekday = weekdayOf(day);
    for (const run of runsOf(windows, weekday)) {
      if (i === 0 && minutesOf(run.startsAt) <= minutes && minutes < minutesOf(run.endsAt)) return { open: true, closesAt: run.endsAt, nextOpen: null };
      if (i > 0 || minutesOf(run.startsAt) > minutes) return { open: false, closesAt: null, nextOpen: { day, weekday, time: run.startsAt, today: i === 0, tomorrow: i === 1 } };
    }
  }
  return { open: false, closesAt: null, nextOpen: null };
}

/**
 * Where one member of the team stands right now, for the public page (akinaza#209): free, busy until a time, starting
 * later today, done for the day, away today, or on time off until a day. Read from their weekly hours, today's visits and
 * their time off — never a client, a service or a reason. Pure: the clock and the zone are parameters.
 */
export const MEMBER_STATE = { free: "free", busy: "busy", startsAt: "startsAt", done: "done", away: "away", off: "off" } as const;
export type MemberState =
  | { kind: typeof MEMBER_STATE.free }
  | { kind: typeof MEMBER_STATE.busy; until: string }
  | { kind: typeof MEMBER_STATE.startsAt; time: string }
  | { kind: typeof MEMBER_STATE.done }
  | { kind: typeof MEMBER_STATE.away }
  | { kind: typeof MEMBER_STATE.off; until: string };

export interface MemberDay {
  windows: readonly WeeklyWindow[];
  /** Their visits of the day that still hold the time (booked or under way), as instants. */
  visits: readonly { startsAt: Date; endsAt: Date }[];
  /** The last day of the time off they are on, when they are. */
  offUntil: string | null;
}

const localMinutes = (instant: Date, timezone: string) => {
  const local = new TZDate(instant, timezone);
  return local.getHours() * 60 + local.getMinutes();
};
const clockOf = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export function memberStateAt(member: MemberDay, now: Date, timezone: string): MemberState {
  if (member.offUntil) return { kind: MEMBER_STATE.off, until: member.offUntil };
  const runs = runsOf(member.windows, weekdayOf(localDay(now, timezone)));
  if (!runs.length) return { kind: MEMBER_STATE.away };
  const minutes = localMinutes(now, timezone);
  const run = runs.find((r) => minutesOf(r.startsAt) <= minutes && minutes < minutesOf(r.endsAt));
  if (!run) {
    const next = runs.find((r) => minutesOf(r.startsAt) > minutes);
    return next ? { kind: MEMBER_STATE.startsAt, time: next.startsAt } : { kind: MEMBER_STATE.done };
  }
  // Busy until the end of the visit under way, or of the chain of visits that follow it without a gap.
  const visits = [...member.visits].sort((a, b) => compareAsc(a.startsAt, b.startsAt));
  let until: Date | null = null;
  for (const v of visits) {
    if (until === null ? v.startsAt <= now && now < v.endsAt : v.startsAt <= until && v.endsAt > until) until = v.endsAt;
  }
  if (!until) return { kind: MEMBER_STATE.free };
  return { kind: MEMBER_STATE.busy, until: clockOf(Math.min(localMinutes(until, timezone), minutesOf(run.endsAt))) };
}

export interface DaySchedule {
  weekday: number;
  windows: { startsAt: string; endsAt: string }[];
}

/** The week, Monday first, one entry per day (closed days have no window), times as `HH:MM`. */
export function weekSchedule(windows: readonly WeeklyWindow[]): DaySchedule[] {
  return [1, 2, 3, 4, 5, 6, 0].map((weekday) => ({
    weekday,
    windows: windows.filter((w) => w.weekday === weekday).map((w) => ({ startsAt: clock(w.startsAt), endsAt: clock(w.endsAt) })).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
  }));
}

export interface SlotDay {
  /** The shop's local day, `YYYY-MM-DD`. */
  day: string;
  slots: Slot[];
}

/** The offered slots grouped by the shop's local day (first days, first times) — what the page shows as chips. */
export function groupSlotsByDay(slots: readonly Slot[], timezone: string, limits: { maxDays: number; maxPerDay: number }): SlotDay[] {
  const days: SlotDay[] = [];
  for (const slot of slots) {
    const day = localDay(slot.startsAt, timezone);
    let entry = days.find((d) => d.day === day);
    if (!entry) {
      if (days.length >= limits.maxDays) continue;
      entry = { day, slots: [] };
      days.push(entry);
    }
    if (entry.slots.length < limits.maxPerDay) entry.slots.push(slot);
  }
  return days;
}

/**
 * The service to tag « Popular »: the strictly most booked one, only once it has `minBookings` and the shop sells more than
 * one service (a lone service is not more popular than anything). Never a guess: no bookings, no tag.
 */
// @fixed: display heuristic, not a business rule — three bookings before a service is called popular, two services to compare.
export function popularServiceId(counts: readonly { serviceId: string; bookings: number }[], minBookings = 3, minServices = 2): string | null {
  if (counts.length < minServices) return null;
  const sorted = [...counts].sort((a, b) => b.bookings - a.bookings);
  const [first, second] = sorted;
  if (!first || first.bookings < minBookings) return null;
  if (second && second.bookings === first.bookings) return null;
  return first.serviceId;
}

const instant = z.string().datetime({ offset: true });

export interface BookingPreselect {
  serviceId: string | null;
  zoneId: string | null;
  /** An ISO instant. */
  startsAt: string | null;
}

/** What the booking page keeps of its address (`?service=&zone=&start=`): only what the shop offers; a time needs its service. */
export function bookingPreselect(
  input: { service?: string | null; zone?: string | null; start?: string | null },
  services: readonly { id: string }[],
  zones: readonly { id: string }[],
): BookingPreselect {
  const serviceId = services.find((s) => s.id === input.service)?.id ?? null;
  const zoneId = zones.find((z) => z.id === input.zone)?.id ?? null;
  const start = serviceId && input.start && instant.safeParse(input.start).success ? new Date(input.start).toISOString() : null;
  return { serviceId, zoneId, startsAt: start };
}

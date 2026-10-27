import { addLocalDays, localDay, localInstant, weekdayOf } from "../service-shop";
import { type BusyInterval, type BusyRange, mergeBusy } from "./source";

/**
 * The busy times of an iCalendar file (RFC 5545), read-only: events that really take the owner's time, recurrences expanded
 * inside the window, titles and attendees never read. Floating times and all-day events are the shop's time zone.
 * Supported recurrences: DAILY, WEEKLY (BYDAY), MONTHLY and YEARLY with INTERVAL, COUNT, UNTIL, EXDATE and overridden instances.
 * Instants are epoch milliseconds inside the parser; days are `YYYY-MM-DD` strings, so wall-clock times survive a daylight-saving change.
 */
export interface IcsBusyOptions extends BusyRange {
  timezone: string;
}

// @fixed: a calendar file that expands to more occurrences than this (fifty years of daily events) is cut there
const MAX_OCCURRENCES = 20_000;
// @fixed: the length of an all-day event with no end, in milliseconds (one day)
const ALL_DAY_MS = 86_400_000;
const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

interface Prop {
  params: Record<string, string>;
  value: string;
}
type Props = Record<string, Prop[]>;

function unfold(text: string): string[] {
  return text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/).filter((l) => l.length > 0);
}

/** The index of the colon that ends the name and parameters (a colon inside quotes does not), or -1. */
function colonIndex(line: string): number {
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') quoted = !quoted;
    else if (line[i] === ":" && !quoted) return i;
  }
  return -1;
}

function paramsOf(rest: string[]): Record<string, string> {
  const params: Record<string, string> = {};
  for (const p of rest) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replaceAll('"', "");
  }
  return params;
}

function parseProp(line: string): { name: string; prop: Prop } | null {
  const colon = colonIndex(line);
  if (colon < 1) return null;
  const [name, ...rest] = line.slice(0, colon).split(";");
  return { name: name!.toUpperCase(), prop: { params: paramsOf(rest), value: line.slice(colon + 1) } };
}

function events(text: string): Props[] {
  const out: Props[] = [];
  let current: Props | null = null;
  let depth = 0;
  for (const line of unfold(text)) {
    const upper = line.toUpperCase();
    if (upper === "BEGIN:VEVENT") {
      current = {};
      depth = 0;
    } else if (upper === "END:VEVENT") {
      if (current) out.push(current);
      current = null;
    } else if (current && upper.startsWith("BEGIN:")) depth++;
    else if (current && upper.startsWith("END:")) depth--;
    else if (current && depth === 0) {
      const parsed = parseProp(line);
      if (parsed) {
        current[parsed.name] ??= [];
        current[parsed.name]!.push(parsed.prop);
      }
    }
  }
  return out;
}

interface Moment {
  /** Epoch milliseconds. */
  at: number;
  tz: string;
  allDay: boolean;
}

function validZone(name: string | undefined, fallback: string): string {
  if (!name) return fallback;
  try {
    new Intl.DateTimeFormat("en", { timeZone: name });
    return name;
  } catch {
    return fallback; // a Windows zone name (« Eastern Standard Time »): the shop's own zone is the nearest honest reading
  }
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");
const dayOf = (y: number, m: number, d: number) => `${pad(y, 4)}-${pad(m)}-${pad(d)}`;

/** Minutes since midnight of an instant on the wall clock of a zone. */
function minutesOfDay(at: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(at));
  return Number(parts.find((p) => p.type === "hour")!.value) * 60 + Number(parts.find((p) => p.type === "minute")!.value);
}

function parseMoment(prop: Prop, shopZone: string): Moment | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(prop.value.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (m[4] === undefined || prop.params.VALUE === "DATE") return { at: localInstant(dayOf(y, mo, d), 0, shopZone).getTime(), tz: shopZone, allDay: true };
  const [h, mi, s] = [Number(m[4]), Number(m[5]), Number(m[6] ?? 0)];
  if (m[7]) return { at: Date.UTC(y, mo - 1, d, h, mi, s), tz: "UTC", allDay: false };
  // A zoned time is read to the minute: calendar apps write whole minutes.
  const tz = validZone(prop.params.TZID, shopZone);
  return { at: localInstant(dayOf(y, mo, d), h * 60 + mi, tz).getTime(), tz, allDay: false };
}

function parseDuration(value: string): number | null {
  const m = /^([+-])?P([^T]*)(?:T(.*))?$/.exec(value.trim());
  const date = m ? /^(?:(\d+)W)?(?:(\d+)D)?$/.exec(m[2]!) : null;
  const time = m ? /^(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(m[3] ?? "") : null;
  if (!m || !date || !time) return null;
  const seconds = Number(date[1] ?? 0) * 604_800 + Number(date[2] ?? 0) * 86_400 + Number(time[1] ?? 0) * 3_600 + Number(time[2] ?? 0) * 60 + Number(time[3] ?? 0);
  return (m[1] === "-" ? -seconds : seconds) * 1_000;
}

interface Rule {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  count: number | null;
  /** Exclusive, epoch milliseconds: the first instant the rule no longer reaches. */
  until: number | null;
  byDay: number[];
}

/** UNTIL is inclusive: a date-only one is that whole day (up to the next midnight), a time is itself (up to the next millisecond). */
function exclusiveEnd(until: Moment): number {
  if (!until.allDay) return until.at + 1;
  return localInstant(addLocalDays(localDay(new Date(until.at), until.tz), 1), 0, until.tz).getTime();
}

function parseRule(value: string, zone: string): Rule | null {
  const parts = Object.fromEntries(value.split(";").map((p) => p.split("=") as [string, string]));
  if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(parts.FREQ ?? "")) return null;
  const until = parts.UNTIL ? parseMoment({ params: {}, value: parts.UNTIL }, zone) : null;
  const untilMs = until ? exclusiveEnd(until) : null;
  return {
    freq: parts.FREQ as Rule["freq"],
    interval: Math.max(1, Number(parts.INTERVAL ?? 1) || 1),
    count: parts.COUNT ? Number(parts.COUNT) : null,
    until: untilMs,
    byDay: (parts.BYDAY ?? "").split(",").map((d) => WEEKDAYS.indexOf(d.slice(-2))).filter((i) => i >= 0),
  };
}

/** A day `n` months on, clamped to the end of a shorter month. */
function addMonthsLocal(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return dayOf(first.getUTCFullYear(), first.getUTCMonth() + 1, Math.min(d, last));
}

/** The days of the `k`-th period of a rule (a week, a month, a year...), in order. */
function daysOfPeriod(startDay: string, rule: Rule, k: number): string[] {
  if (rule.freq === "DAILY") return [addLocalDays(startDay, k * rule.interval)];
  if (rule.freq === "WEEKLY") {
    const monday = addLocalDays(startDay, k * rule.interval * 7 - ((weekdayOf(startDay) + 6) % 7)); // weeks start on Monday
    const weekdays = rule.byDay.length > 0 ? rule.byDay : [weekdayOf(startDay)];
    return weekdays.map((w) => addLocalDays(monday, (w + 6) % 7)).sort((a, b) => a.localeCompare(b));
  }
  return [addMonthsLocal(startDay, k * rule.interval * (rule.freq === "YEARLY" ? 12 : 1))];
}

/** The starts of a recurring event, in order, up to the end of the window (counted from the first occurrence, as the rule is). */
function occurrenceStarts(first: Moment, rule: Rule, untilMs: number): number[] {
  const out: number[] = [];
  const startDay = localDay(new Date(first.at), first.tz);
  const minutes = minutesOfDay(first.at, first.tz);
  const startOf = (day: string) => (day === startDay ? first.at : localInstant(day, minutes, first.tz).getTime());
  const reached = (start: number) => start >= untilMs || (rule.until !== null && start >= rule.until);
  let k = 0;
  while (out.length < MAX_OCCURRENCES) {
    const days = daysOfPeriod(startDay, rule, k++);
    for (const day of days) {
      if (day < startDay) continue;
      const start = startOf(day);
      if (reached(start)) return out;
      out.push(start);
      if (rule.count !== null && out.length >= rule.count) return out;
    }
    if (startOf(days[0]!) >= untilMs) return out;
  }
  return out;
}

/** The starts of each event that a later occurrence replaces (RECURRENCE-ID), by UID. */
function overriddenStarts(all: Props[], timezone: string): Map<string, Set<number>> {
  const overridden = new Map<string, Set<number>>();
  for (const e of all) {
    const id = e["RECURRENCE-ID"]?.[0];
    const uid = e.UID?.[0]?.value;
    const moment = id ? parseMoment(id, timezone) : null;
    if (!uid || !moment) continue;
    const set = overridden.get(uid) ?? new Set<number>();
    set.add(moment.at);
    overridden.set(uid, set);
  }
  return overridden;
}

/** How long the event lasts, in milliseconds (0 or less: nothing to block). */
function lengthOf(e: Props, first: Moment, timezone: string): number {
  const end = e.DTEND?.[0] ? parseMoment(e.DTEND[0], timezone) : null;
  if (end) return end.at - first.at;
  const duration = e.DURATION?.[0] ? parseDuration(e.DURATION[0].value) : null;
  if (duration !== null) return duration;
  return first.allDay ? ALL_DAY_MS : 0;
}

/** The occurrences left out: the ones overridden by another event and the EXDATEs. */
function skippedStarts(e: Props, overridden: Map<string, Set<number>>, timezone: string): Set<number> {
  const uid = e.UID?.[0]?.value;
  const skip = new Set<number>(uid && !e["RECURRENCE-ID"] ? overridden.get(uid) : []);
  for (const ex of e.EXDATE ?? [])
    for (const v of ex.value.split(",")) {
      const m = parseMoment({ params: ex.params, value: v }, timezone);
      if (m) skip.add(m.at);
    }
  return skip;
}

/** The busy times of an ICS file inside the window, merged. Malformed events are skipped, never fatal. */
export function parseBusy(text: string, options: IcsBusyOptions): BusyInterval[] {
  const { timezone } = options;
  const [from, to] = [options.from.getTime(), options.to.getTime()];
  const all = events(text);
  const overridden = overriddenStarts(all, timezone);
  const out: BusyInterval[] = [];
  for (const e of all) {
    if (e.TRANSP?.[0]?.value.toUpperCase() === "TRANSPARENT") continue;
    if (e.STATUS?.[0]?.value.toUpperCase() === "CANCELLED") continue;
    const first = e.DTSTART?.[0] ? parseMoment(e.DTSTART[0], timezone) : null;
    if (!first) continue;
    const length = lengthOf(e, first, timezone);
    if (length <= 0) continue;
    const skip = skippedStarts(e, overridden, timezone);
    const rule = e.RRULE?.[0] ? parseRule(e.RRULE[0].value, timezone) : null;
    const starts = rule && !e["RECURRENCE-ID"] ? occurrenceStarts(first, rule, to) : [first.at];
    for (const start of starts) {
      if (skip.has(start) || start + length <= from || start >= to) continue;
      out.push({ startsAt: new Date(start), endsAt: new Date(start + length) });
    }
  }
  return mergeBusy(out);
}

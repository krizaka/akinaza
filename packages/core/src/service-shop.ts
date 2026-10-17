import { TZDate } from "@date-fns/tz";
import { addDays, addMinutes, compareAsc, differenceInSeconds, format, isBefore } from "date-fns";
import { z } from "zod";

/**
 * The generic service-shop model (ADR-001): a shop sells time (services), has zones, weekly availability and a capacity,
 * takes bookings from clients for their dependants (a dog, a cat…), and reports on each visit. Nothing here says "dog"
 * except the profile schema of the `dog` kind. Pure and deterministic: the clock and the time zone are parameters.
 */

export const DEPENDANT_KINDS = ["dog", "cat", "other"] as const;
export type DependantKind = (typeof DEPENDANT_KINDS)[number];

export const DOG_SIZES = ["small", "medium", "large"] as const;
const contact = z.object({ name: z.string().trim().min(1).max(120), phone: z.string().trim().min(7).max(40) });

/** What a shop keeps about a dependant beyond its name: validated at the door, stored as JSON, erased with the client. */
export const dependantProfileSchema = z.object({
  breed: z.string().trim().max(80).optional(),
  size: z.enum(DOG_SIZES).optional(),
  temperament: z.string().trim().max(500).optional(),
  vet: contact.optional(),
  emergency: contact.optional(),
});
export type DependantProfile = z.infer<typeof dependantProfileSchema>;

export const dependantInputSchema = z.object({ kind: z.enum(DEPENDANT_KINDS), name: z.string().trim().min(1).max(80), profile: dependantProfileSchema.default({}) });
export type DependantInput = z.infer<typeof dependantInputSchema>;

/** A shop page address: lowercase words joined by hyphens, never a word the site itself uses. */
export const RESERVED_SLUGS = ["admin", "api", "app", "en", "fr", "s", "report", "privacy", "sign-in", "sign-up", "forgot-password", "reset-password", "console", "akinaza", "krizaka", "www", "dev"] as const;
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(40)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .refine((s) => !(RESERVED_SLUGS as readonly string[]).includes(s), { message: "reserved" });

/** `HH:MM`, 24 h, in the shop's time zone. */
export const clockSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const localDaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export interface WeeklyWindow {
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  startsAt: string;
  endsAt: string;
}

/** A visit already on the staff member's calendar (cancelled ones are not passed), with the seats taken. */
export interface TakenVisit {
  startsAt: Date;
  endsAt: Date;
  serviceId: string;
  zoneId: string | null;
  seatsTaken: number;
}

export interface Slot {
  startsAt: Date;
  endsAt: Date;
  seatsLeft: number;
  capacity: number;
  /** True when the slot is a group visit that already has dogs booked (the client joins it). */
  joins: boolean;
}

export interface SlotRequest {
  timezone: string;
  now: Date;
  /** First local day offered, `YYYY-MM-DD`. */
  fromDay: string;
  /** How many local days are offered. */
  days: number;
  windows: readonly WeeklyWindow[];
  daysOff: readonly string[];
  serviceId: string;
  zoneId: string | null;
  durationMinutes: number;
  stepMinutes: number;
  capacity: number;
  /** Nothing is offered that starts sooner than this after `now`. */
  minNoticeMinutes: number;
  visits: readonly TakenVisit[];
}

const minutesOfClock = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));

/** A wall-clock time of a local day, as an instant in the shop's zone. */
export function localInstant(day: string, minutes: number, timezone: string): Date {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(new TZDate(y, m - 1, d, Math.floor(minutes / 60), minutes % 60, 0, timezone).getTime());
}

/** The local day (`YYYY-MM-DD`) an instant falls in, in the shop's zone. */
export const localDay = (instant: Date, timezone: string): string => format(new TZDate(instant, timezone), "yyyy-MM-dd");

/** The weekday (0 = Sunday) of a local day. */
export function weekdayOf(day: string): number {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** The day `n` days after a local day. */
export function addLocalDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return format(addDays(new Date(Date.UTC(y, m - 1, d, 12)), n), "yyyy-MM-dd");
}

const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) => isBefore(aStart, bEnd) && isBefore(bStart, aEnd);

/**
 * The start times a client may book: inside the weekly windows, not on a day off, far enough from now, and either free
 * or — for a group service — the very same visit (same start, service and zone) with seats left. Anything else that
 * overlaps another visit is not offered. The database stays the judge at write time; this only decides what to show.
 */
export function openSlots(request: SlotRequest): Slot[] {
  const out: Slot[] = [];
  const earliest = addMinutes(request.now, request.minNoticeMinutes);
  for (let i = 0; i < request.days; i++) {
    const day = addLocalDays(request.fromDay, i);
    if (request.daysOff.includes(day)) continue;
    const weekday = weekdayOf(day);
    for (const window of request.windows) {
      if (window.weekday !== weekday) continue;
      const open = minutesOfClock(window.startsAt);
      const close = minutesOfClock(window.endsAt);
      for (let t = open; t + request.durationMinutes <= close; t += request.stepMinutes) {
        const startsAt = localInstant(day, t, request.timezone);
        const endsAt = addMinutes(startsAt, request.durationMinutes);
        if (isBefore(startsAt, earliest)) continue;
        const same = request.visits.find((v) => v.startsAt.getTime() === startsAt.getTime() && v.endsAt.getTime() === endsAt.getTime() && v.serviceId === request.serviceId && v.zoneId === request.zoneId);
        if (same && request.capacity > 1) {
          if (same.seatsTaken < request.capacity) out.push({ startsAt, endsAt, seatsLeft: request.capacity - same.seatsTaken, capacity: request.capacity, joins: true });
          continue;
        }
        if (request.visits.some((v) => overlaps(startsAt, endsAt, v.startsAt, v.endsAt))) continue;
        out.push({ startsAt, endsAt, seatsLeft: request.capacity, capacity: request.capacity, joins: false });
      }
    }
  }
  return out.sort((a, b) => compareAsc(a.startsAt, b.startsAt));
}

/** A booking may be cancelled until `cancellationHours` before the visit starts (the shop's rule). */
export const canCancel = (startsAt: Date, now: Date, cancellationHours: number): boolean => !isBefore(addMinutes(startsAt, -cancellationHours * 60), now);

/** The time the walker spent, in whole minutes, from the check-in and check-out instants (at least one). */
export const visitMinutes = (checkedInAt: Date, checkedOutAt: Date): number => Math.max(1, Math.round(differenceInSeconds(checkedOutAt, checkedInAt) / 60));

/** The image kinds a report photo may be, recognised by their first bytes — the declared type is never trusted. */
export function sniffImage(bytes: Uint8Array): "jpeg" | "png" | "webp" | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "webp";
  return null;
}

export const reportNoteSchema = z.string().trim().min(1).max(1000);

/** The words a shop's rules may take: bounds the database repeats in CHECKs, so a bad value is refused at the door first. */
export const shopRulesSchema = z.object({
  cancellationHours: z.number().int().min(0).max(168),
  bookingHorizonDays: z.number().int().min(1).max(180),
  slotStepMinutes: z.number().int().min(5).max(240),
  minNoticeMinutes: z.number().int().min(0).max(10_080),
  reportLinkDays: z.number().int().min(1).max(365),
});
export type ShopRules = z.infer<typeof shopRulesSchema>;

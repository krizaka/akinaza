import { invoiceTotals, type TaxCategory } from "@akinaza/core";

/** The strip shows a few days before the chosen one, so « yesterday » is one tap away; it stays put while the chosen day is inside it. */
const DAYS_BEFORE = 3;
const STRIP_DAYS = 14;

const MS_PER_DAY = 86_400_000; // @fixed: the length of a calendar day in UTC, where this arithmetic is done.

export const AppointmentStatus = { Booked: "booked", Done: "done", Cancelled: "cancelled", NoShow: "noShow" } as const;
export type AppointmentStatus = (typeof AppointmentStatus)[keyof typeof AppointmentStatus];

/** A real calendar day written `YYYY-MM-DD` (`2026-02-30` is refused). */
export function isIsoDay(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

export function shiftDay(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** The first day of the strip around `day`: anchored on today while the chosen day is in its reach, on the chosen day otherwise. */
export function stripWindow(day: string, today: string): { start: string; days: number } {
  const anchor = shiftDay(today, -DAYS_BEFORE);
  const last = shiftDay(anchor, STRIP_DAYS - 1);
  return day >= anchor && day <= last ? { start: anchor, days: STRIP_DAYS } : { start: shiftDay(day, -DAYS_BEFORE), days: STRIP_DAYS };
}

export interface PricedAppointment {
  id: string;
  startsAt: string;
  status: AppointmentStatus;
  client: string | null;
  priceCents: number;
  category: TaxCategory;
}

export interface DaySummary {
  /** Appointments that still count: neither cancelled nor missed. */
  count: number;
  /** What the day will bill, taxes included (a small supplier charges none). */
  expectedCents: number;
  /** The first booked appointment after `now`. */
  next: { id: string; client: string | null; startsAt: string } | null;
}

export function daySummary(appointments: readonly PricedAppointment[], registrant: boolean, now: Date): DaySummary {
  const counting = appointments.filter((a) => a.status === AppointmentStatus.Booked || a.status === AppointmentStatus.Done);
  const totals = invoiceTotals(
    counting.map((a) => ({ description: a.id, quantity: 1, unitPriceCents: a.priceCents, category: a.category })),
    { registrant },
  );
  const next = counting
    .filter((a) => a.status === AppointmentStatus.Booked && Date.parse(a.startsAt) > now.getTime())
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0];
  return { count: counting.length, expectedCents: totals.totalCents, next: next ? { id: next.id, client: next.client, startsAt: next.startsAt } : null };
}

/** The words an appointment is read in: « booked » with a visit begun reads « in progress », the one status the database does not name. */
export const InProgress = "inProgress";
export type StatusWord = AppointmentStatus | typeof InProgress;

export function statusWord(a: { status: AppointmentStatus; checkedInAt?: string | null }): StatusWord {
  return a.status === AppointmentStatus.Booked && a.checkedInAt ? InProgress : a.status;
}

/** The tone of a status chip and of the agenda's dot. The word carries the meaning, the colour only repeats it. */
export const STATUS_TONE = { booked: "neutral", inProgress: "accent", done: "success", cancelled: "neutral", noShow: "warning" } as const satisfies Record<StatusWord, string>;

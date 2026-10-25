import { localDay } from "@krizaka/intl";

/** A local day (`2026-10-20`) and its neighbours: the owner's day screen steps through them, and the URL keeps the one shown. */
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const isDay = (value: string | undefined): value is string => !!value && DAY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

export function shiftDay(day: string, by: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + by);
  return localDay(date, "UTC");
}

/** `13:00` of an instant, in the shop's time zone (the answers carry instants; the screen draws the owner's clock). */
export function timeOf(instant: string, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone }).format(new Date(instant));
}

/** The shop's time zone until its own is read (Québec's, the market Akinaza serves). */
// @fixed: a default read only before the shop answers with its own time zone
export const DEFAULT_TIMEZONE = "America/Toronto";

/** How many days the day strip of Aujourd'hui shows, and how many of them before the day shown (D8: the calendar folded in). */
// @fixed: two weeks in a row a thumb can scroll, the day shown fourth so the days before it stay in reach
export const STRIP_DAYS = 14;
// @fixed: three days back, as the web's strip
export const STRIP_BEFORE = 3;

/** The strip around the day shown: its first and last day, for the strip and for the calendar's marks. */
export const stripWindow = (day: string): { start: string; end: string } => ({ start: shiftDay(day, -STRIP_BEFORE), end: shiftDay(day, STRIP_DAYS - STRIP_BEFORE - 1) });

/** The BCP 47 tag of the app's language, for a date drawn by the platform. */
export const LANGUAGE_TAG = { fr: "fr-CA", en: "en-CA" } as const;

/** A local day (`2026-10-20`) and its neighbours: the owner's day screen steps through them, and the URL keeps the one shown. */
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const isDay = (value: string | undefined): value is string => !!value && DAY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

export function shiftDay(day: string, by: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + by);
  return date.toISOString().slice(0, 10);
}

/** `13:00` of an instant, in the shop's time zone (the answers carry instants; the screen draws the owner's clock). */
export function timeOf(instant: string, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone }).format(new Date(instant));
}

/** The shop's time zone until its own is read (Québec's, the market Akinaza serves). */
// @fixed: a default read only before the shop answers with its own time zone
export const DEFAULT_TIMEZONE = "America/Toronto";

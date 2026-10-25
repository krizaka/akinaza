import { formatDate as intlDate, formatMoney as intlMoney, getDateTimeFormat } from "@krizaka/intl";

/** The BCP 47 tag the shop's money, dates and times are written in: Canadian English or Canadian French. */
export const INTL_LOCALE = { en: "en-CA", fr: "fr-CA" } as const;

export type FormatLocale = keyof typeof INTL_LOCALE;

/** Integer cents in Canadian dollars, in the language's habit (« 123,45 $ », « $123.45 »); a float throws (@krizaka/intl). */
export function formatMoney(cents: number, locale: FormatLocale): string {
  return intlMoney(cents, { currency: "CAD", locale: INTL_LOCALE[locale] });
}

/** « Thursday, October 22, 2026 » for a `YYYY-MM-DD` day, whatever the machine's zone. */
export function formatLongDay(day: string, locale: FormatLocale): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString(INTL_LOCALE[locale], { dateStyle: "full", timeZone: "UTC" });
}

export function formatTime(iso: string, locale: FormatLocale, timeZone: string): string {
  return new Date(iso).toLocaleTimeString(INTL_LOCALE[locale], { hour: "2-digit", minute: "2-digit", timeZone });
}

export function formatDate(iso: string, locale: FormatLocale, timeZone: string): string {
  return intlDate(iso, { locale: INTL_LOCALE[locale], style: "medium", timeZone });
}

/** « October 2026 » / « octobre 2026 »: the month an instant falls in, in a time zone (an account's « member since »). */
export function formatMonth(instant: Date | string, locale: FormatLocale, timeZone: string): string {
  return getDateTimeFormat(INTL_LOCALE[locale], { month: "long", year: "numeric", timeZone }).format(new Date(instant));
}

/** The BCP 47 tag the shop's money, dates and times are written in: Canadian English or Canadian French. */
export const INTL_LOCALE = { en: "en-CA", fr: "fr-CA" } as const;

export type FormatLocale = keyof typeof INTL_LOCALE;

export function formatMoney(cents: number, locale: FormatLocale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], { style: "currency", currency: "CAD" }).format(cents / 100);
}

/** « Thursday, October 22, 2026 » for a `YYYY-MM-DD` day, whatever the machine's zone. */
export function formatLongDay(day: string, locale: FormatLocale): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString(INTL_LOCALE[locale], { dateStyle: "full", timeZone: "UTC" });
}

export function formatTime(iso: string, locale: FormatLocale, timeZone: string): string {
  return new Date(iso).toLocaleTimeString(INTL_LOCALE[locale], { hour: "2-digit", minute: "2-digit", timeZone });
}

export function formatDate(iso: string, locale: FormatLocale, timeZone: string): string {
  return new Date(iso).toLocaleDateString(INTL_LOCALE[locale], { dateStyle: "medium", timeZone });
}

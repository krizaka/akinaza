const INTL = { en: "en-CA", fr: "fr-CA" } as const;

/** A date for the console: medium date, and the time when asked. */
export function formatDate(iso: string, locale: "en" | "fr", time = false): string {
  return new Date(iso).toLocaleString(INTL[locale], time ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
}

/** Integer cents as dollars for the locale ($1,234.56 · 1 234,56 $). Display only: the arithmetic is always in cents. */
export function formatMoney(cents: number, locale: "en" | "fr"): string {
  return new Intl.NumberFormat(INTL[locale], { style: "currency", currency: "CAD" }).format(cents / 100);
}

/** Whole cents as dollars, in the reader's language (`45,00 $` in French, `$45.00` in English). Cents stay integers everywhere else. */
export function dollars(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);
}

/** What the owner typed (`45`, `45,5`, `45.50`) as whole cents, or null when it is not an amount. */
export function centsOf(text: string): number | null {
  const normalised = text.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(normalised)) return null;
  return Math.round(Number(normalised) * 100);
}

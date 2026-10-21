import { z } from "zod";

/** What the quantity field accepts while it is typed: digits, then optionally a point or a comma and up to two decimals. */
export const QUANTITY_FIELD = z.string().regex(/^(\d{0,5}([.,]\d{0,2})?)$/);

/** A quantity as typed (`7,5`, `7.25`, `10`) → a number to the hundredth, or null when it is empty, zero or finer than a hundredth. */
export function parseQuantity(typed: string): number | null {
  const text = typed.trim();
  if (!/^\d{1,5}([.,]\d{1,2})?$/.test(text)) return null;
  const quantity = Number(text.replace(",", "."));
  return quantity >= 0.01 ? quantity : null;
}

/** A quantity for a reader of `locale`: `7,5` or `7.5`, at most two decimals, no trailing zero. */
export const formatQuantity = (quantity: number, locale: "fr" | "en"): string => new Intl.NumberFormat(locale === "fr" ? "fr-CA" : "en-CA", { maximumFractionDigits: 2 }).format(quantity);

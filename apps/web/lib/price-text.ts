import { formatPrice } from "@krizaka/payments";
import type { PriceEntry } from "@krizaka/settings";

import { INTL_LOCALE } from "./format";

/** The catalogue's figures in the visitor's writing (akinaza#371): no amount is ever typed in a message, it is formatted here. */

/** An entry's amount as the visitor reads it (« 45 $ », « $45 »), or null for an entry without a figure. */
export function priceText(entry: Pick<PriceEntry, "amountCents" | "unit">, locale: "en" | "fr"): string | null {
  if (entry.amountCents === null) return null;
  return formatPrice({ amount: entry.amountCents, currency: "cad", interval: entry.unit === "month" || entry.unit === "year" ? entry.unit : null }, locale);
}

/** An amount of cents in the visitor's writing (a cap, a fee). */
export const centsText = (cents: number, locale: "en" | "fr") => formatPrice({ amount: cents, currency: "cad", interval: null }, locale);

/** Basis points as a percentage in the visitor's writing (« 0,5 % », « 0.5% »). */
export const rateText = (bps: number, locale: "en" | "fr") => new Intl.NumberFormat(INTL_LOCALE[locale], { style: "percent", maximumFractionDigits: 2 }).format(bps / 10_000);

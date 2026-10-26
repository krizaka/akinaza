import { AVAILABILITY, type PriceCatalogue, type PriceEntry, type PublicPrice } from "@krizaka/settings";

import { centsText, priceText, rateText } from "./price-text";
import { SCALE, STARTER } from "./pricing";

/** The words of the Starter offer, every figure read from the catalogue's entry and formatted with the visitor's locale. */
export interface FounderOfferCopy {
  [name: string]: string | number;
  price: string;
  limit: number;
  cardRate: string;
  debitRate: string;
  debitCap: string;
}

/** How many businesses the founder offer is offered to: the Starter entry's `founderCap` limit (akinaza#371). */
export const founderCap = (entry: Pick<PriceEntry, "limits">): number => entry.limits.founderCap ?? 0;

/** The Starter entry in force at a date: the founder offer, its price, its cap and its fees. */
export const starterEntry = (catalogue: PriceCatalogue, at: Date) => catalogue.entry(STARTER, at);

/** Whether an entry is on sale: a figure, and offered to everyone or to the first businesses. */
export const onSale = (entry: Pick<PriceEntry, "availability" | "amountCents">): boolean =>
  entry.amountCents !== null && (entry.availability === AVAILABILITY.public || entry.availability === AVAILABILITY.founderLimited);

/** The offer's copy, or null when the entry is not on sale (no figure, internal, or in preparation): no guess, no stale price. */
export function founderOfferCopy(entry: PriceEntry, locale: "en" | "fr"): FounderOfferCopy | null {
  if (!onSale(entry)) return null;
  const price = priceText(entry, locale);
  if (price === null) return null;
  return {
    price,
    limit: founderCap(entry),
    cardRate: rateText(entry.limits.cardFeeBps ?? 0, locale),
    debitRate: rateText(entry.limits.directDebitBps ?? 0, locale),
    debitCap: centsText(entry.limits.directDebitCapCents ?? 0, locale),
  };
}

/**
 * Scale B2B as a visitor reads it, from the public view of the catalogue: absent when internal, « in preparation » without a
 * figure while `preparing` (`publicCatalogue` has already dropped it), its price once on sale.
 */
export function scaleView(entries: readonly PublicPrice[], locale: "en" | "fr"): { price: string | null } | null {
  const entry = entries.find((e) => e.key === SCALE);
  if (!entry) return null;
  return { price: entry.availability === AVAILABILITY.preparing ? null : priceText(entry, locale) };
}

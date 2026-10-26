import { AVAILABILITY, type PriceCatalogue, type PriceEntry, type PublicPrice } from "@krizaka/settings";

import { centsText, priceText, rateText } from "./price-text";
import { FOUNDER, SCALE, STARTER } from "./pricing";

/** The words of the Starter offer, every figure read from the catalogue's entry and formatted with the visitor's locale. */
export interface FounderOfferCopy {
  [name: string]: string | number;
  price: string;
  limit: number;
  cardRate: string;
  debitRate: string;
  debitCap: string;
}

/** How many businesses the founder offer is offered to: the founder entry's `founderCap` limit (akinaza#371). */
export const founderCap = (entry: Pick<PriceEntry, "limits">): number => entry.limits.founderCap ?? 0;

/** The founder entry in force at a date: its price, its cap and its fees. The administrator ends the offer by making it `internal`. */
export const founderEntry = (catalogue: PriceCatalogue, at: Date) => catalogue.entry(FOUNDER, at);

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
 * The regular plans as a visitor reads them, from the public view of the catalogue: absent when internal, without a figure
 * while `preparing` (`publicCatalogue` has already dropped it), their price once public.
 */
export function plansView(entries: readonly PublicPrice[], locale: "en" | "fr"): Record<"starter" | "scale", { price: string | null } | null> {
  const view = (key: string) => {
    const entry = entries.find((e) => e.key === key);
    if (!entry) return null;
    return { price: entry.availability === AVAILABILITY.preparing ? null : priceText(entry, locale) };
  };
  return { starter: view(STARTER), scale: view(SCALE) };
}

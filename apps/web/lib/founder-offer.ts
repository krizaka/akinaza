import { formatPrice, type PaymentsPort } from "@krizaka/payments";

import { FOUNDER } from "./payments/config";

export type FounderOfferCopy = { price: string };

/**
 * The founder offer's price as the visitor reads it, formatted with their locale. The amount is the processor's data, read by
 * lookup key — never typed in a message. If it cannot be read, the offer is not shown (null): no guess, no stale price.
 */
export async function founderPrice(port: PaymentsPort | null, locale: "en" | "fr"): Promise<FounderOfferCopy | null> {
  if (!port) return null;
  try {
    return { price: formatPrice(await port.price(FOUNDER), locale) };
  } catch {
    return null;
  }
}

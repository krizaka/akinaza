import { type PriceCatalogue, priceCatalogue, priceStore, publicCatalogue, type PublicPrice } from "@krizaka/settings";

import { query } from "./db";
import { PRICES } from "./pricing";

/**
 * The one catalogue of prices on the server (akinaza#371): the seed of `lib/pricing.ts`, plus the versions the administrator
 * scheduled (`price_versions`, each audited in `settings_audit`). Pages read it at the date they render; a subscription reads
 * the version it was sold at.
 */
const holder = globalThis as unknown as { __akinazaPrices?: PriceCatalogue };

export function appPrices(): PriceCatalogue {
  holder.__akinazaPrices ??= priceCatalogue(PRICES, priceStore({ query: async (sql, params) => query(sql, params as unknown[]) as never }));
  return holder.__akinazaPrices;
}

/** For tests: forget the cached catalogue. */
export const resetAppPrices = () => {
  holder.__akinazaPrices = undefined;
};

/** What a visitor may read: never an `internal` entry; an entry `preparing` without its figure. */
export async function publicPrices(catalogue: PriceCatalogue, at: Date): Promise<PublicPrice[]> {
  return publicCatalogue(await catalogue.catalogue(at));
}

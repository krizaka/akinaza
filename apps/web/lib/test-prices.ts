import { PRICE_SCHEDULE, SCHEDULE_LABEL } from "@akinaza/db";
import { memoryPriceStore, priceCatalogue } from "@krizaka/settings";

import { PRICES } from "./pricing";

/** For tests: the catalogue as it is once the prices_association migration ran, i.e. the seed with the 2026-10-30 grid applied as dated versions (what the database holds). */
export async function pricesInForce(at: Date) {
  const catalogue = priceCatalogue(PRICES, memoryPriceStore());
  for (const change of PRICE_SCHEDULE) {
    const seed = PRICES.defaultOf(change.key);
    await catalogue.schedule({ id: null, label: SCHEDULE_LABEL }, change.key, { ...change.patch, ...(change.limits ? { limits: { ...seed.limits, ...change.limits } } : {}) } as never, at, at);
  }
  return catalogue;
}

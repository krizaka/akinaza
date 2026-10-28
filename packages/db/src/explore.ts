import { type ExploreShop, isOpenNow, localDay } from "@akinaza/core";
import { and, asc, eq, isNotNull } from "drizzle-orm";

import type { Db } from "./client";
import { ShopError } from "./errors";
import { shops } from "./schema";
import { listSlots, publicShop } from "./service-shop";

// @fixed: Explorer lists this many published shops at most (the page is a map and a list, not a directory)
const MAX_SHOPS = 200;
// @fixed: a shop's « free slot today » is read from its first services only, each one query
const SERVICES_CHECKED = 3;

/**
 * The published shops as Explorer shows them (krizaka/akinaza#235): only what the shop's public page already says (name, kind, locality,
 * tagline, the areas it serves with their centres, whether it is open now and has a free time today). No owner, no client, no street
 * address, no count of appointments. Built from `publicShop`, the one projection that cannot leak a column.
 */
export async function exploreShops(db: Db, now: Date): Promise<ExploreShop[]> {
  const rows = await db.select({ slug: shops.slug, kind: shops.kind }).from(shops).where(and(eq(shops.published, true), isNotNull(shops.slug))).orderBy(asc(shops.name)).limit(MAX_SHOPS);
  const built = await Promise.all(
    rows.map(async (row): Promise<ExploreShop | null> => {
      // A published shop whose page cannot be read yet (no rules or staff) is left out: one shop never fails the whole list.
      const page = await publicShop(db, row.slug!).catch((e: unknown) => { if (e instanceof ShopError) return null; throw e; });
      if (!page) return null;
      const located = page.zones.find((z) => z.lat !== null && z.lng !== null);
      const today = localDay(now, page.shop.timezone);
      const free = await Promise.all(
        page.services.slice(0, SERVICES_CHECKED).map((s) => listSlots(db, { shopId: page.shop.id, serviceId: s.id, zoneId: null, now, days: 1, fromDay: today }).then((slots) => slots.length > 0, () => false)),
      );
      return {
        slug: page.shop.slug!,
        name: page.shop.name,
        kind: row.kind,
        area: page.shop.area,
        taglineFr: page.shop.taglineFr,
        taglineEn: page.shop.taglineEn,
        quartiers: page.zones.map((z) => z.name),
        point: located ? [located.lng!, located.lat!] : null,
        openNow: isOpenNow(page.windows, page.daysOff, page.shop.timezone, now),
        freeToday: free.some(Boolean),
      };
    }),
  );
  return built.filter((s): s is ExploreShop => s !== null);
}

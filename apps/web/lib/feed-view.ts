import { areaMatches, FEED_LIMITS, quartierOf } from "@akinaza/core";
import type { FeedFlyerRow } from "@akinaza/db";

import { dayOf, type FlyerView } from "@/lib/community-view";
import { type Locale, translator } from "@/lib/i18n";

/** What the home's neighbourhood feed shows: the flyers (the shops' own board component) and the neighbourhoods to filter by. */
export interface FeedView {
  flyers: FlyerView[];
  /** Every neighbourhood with a flyer up, unfiltered, in alphabetical order: the chips. */
  quartiers: string[];
  /** The neighbourhood asked for, or null for all. */
  quartier: string | null;
}

const compareText = (a: string, b: string) => a.localeCompare(b, "fr-CA");

/**
 * The feed of the neighbourhood: the newest flyers first, at most two of one shop and nine in all, optionally only those of a
 * neighbourhood. Pure: the rows, the language and the filter are parameters, the words come from the catalogues.
 */
export function buildFeed(input: { rows: readonly FeedFlyerRow[]; locale: Locale; quartier?: string | null }): FeedView {
  const { rows, locale } = input;
  const quartier = input.quartier?.trim() || null;
  const t = translator(locale);
  const say = (fr: string, en: string) => ({ fr, en })[locale] || fr || en;
  const quartiers = [...new Map(rows.filter((r) => r.area).map((r) => [quartierOf(r.area!).toLowerCase(), quartierOf(r.area!)])).values()].sort(compareText);
  const perShop = new Map<string, number>();
  const flyers: FlyerView[] = [];
  for (const r of rows) {
    if (flyers.length >= FEED_LIMITS.total) break;
    if (quartier && !areaMatches(r.area, quartier)) continue;
    const taken = perShop.get(r.shopSlug) ?? 0;
    if (taken >= FEED_LIMITS.perShop) continue;
    perShop.set(r.shopSlug, taken + 1);
    flyers.push({
      id: r.id,
      text: say(r.textFr, r.textEn),
      until: r.endsOn ? t("console.shopPage.flyerUntil", { day: dayOf(r.endsOn, locale) }) : null,
      shop: { name: r.shopName, href: `/${locale}/s/${r.shopSlug}` },
    });
  }
  return { flyers, quartiers, quartier };
}

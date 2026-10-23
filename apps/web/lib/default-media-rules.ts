import { type ShopType, shopTypeOf } from "@akinaza/core";
import type { PublicShop } from "@akinaza/db";

import { type ResolvedDefaults, resolveDefaults } from "@/lib/default-media";
import { appSettings } from "@/lib/settings";

/** What the administrator holds for the proposed images: the switch and the trades whose defaults are offered (`features.defaultMedia`, `storefront.defaultMedia.types`). */
export async function defaultMediaRules(): Promise<{ enabled: boolean; types: ShopType[] }> {
  const settings = appSettings();
  const [enabled, types] = await Promise.all([settings.get("features.defaultMedia"), settings.get("storefront.defaultMedia.types")]);
  return { enabled, types: types as ShopType[] };
}

/**
 * The proposed images a public page shows where its owner has none (#267): only when the administrator's switch is on, the owner has not turned them off, and the
 * shop's trade is one the administrator offers. A slot the owner filled is never touched.
 */
export async function proposedDefaults(page: Pick<PublicShop, "shop" | "pageConfig">): Promise<ResolvedDefaults | undefined> {
  if (page.pageConfig?.useDefaults === false) return undefined;
  const rules = await defaultMediaRules();
  const type = shopTypeOf(page.shop.businessType, page.pageConfig?.shopType);
  return rules.enabled && rules.types.includes(type) ? resolveDefaults(type) : undefined;
}

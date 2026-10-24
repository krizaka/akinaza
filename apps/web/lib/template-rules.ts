import type { ShopType } from "@akinaza/core";
import { SHOP_TYPES } from "@akinaza/core";

import { appSettings } from "@/lib/settings";

/** What the administrator holds for the storefront templates: the switch, the templates offered, and the one the picker preselects for each trade. */
export async function templateRules(): Promise<{ enabled: boolean; offered: string[]; defaults: Record<ShopType, string> }> {
  const settings = appSettings();
  const [enabled, offered, ...defaults] = await Promise.all([
    settings.get("features.storefrontTemplates"),
    settings.get("storefront.templates.offered"),
    ...SHOP_TYPES.map((type) => settings.get(`storefront.templates.default.${type}` as never) as Promise<string>),
  ]);
  return { enabled, offered: [...offered], defaults: Object.fromEntries(SHOP_TYPES.map((type, i) => [type, defaults[i]!])) as Record<ShopType, string> };
}

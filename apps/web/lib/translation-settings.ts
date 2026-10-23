import type { PageLocale } from "@akinaza/db";

import { appSettings } from "@/lib/settings";

/** What the administrator holds for the shop page's languages: the switch, the languages an owner may turn on, the runs per shop and day. */
export async function translationRules(): Promise<{ enabled: boolean; allowed: PageLocale[]; dailyLimit: number }> {
  const settings = appSettings();
  const [enabled, allowed, dailyLimit] = await Promise.all([
    settings.get("features.storefrontTranslation"),
    settings.get("storefront.languages.allowed"),
    settings.get("limits.translationsPerShopPerDay"),
  ]);
  return { enabled, allowed: allowed as PageLocale[], dailyLimit };
}

import { bilingual, defineSettings, flag, GLOBAL_ONLY, integer, postgresSettings, type SettingsService, subset, WORKSPACE_SCOPES } from "@krizaka/settings";

import { query } from "./db";
import { refuse } from "./http";

/**
 * Akinaza's configuration as data (`@krizaka/settings`): what an administrator can change without a redeploy. No workspaces here:
 * a value is global, or one person's (a beta, a quota); `WORKSPACE_SCOPES` is global + workspace and a workspace is never named.
 */
export const SETTINGS = {
  "app.maintenance": flag("general", false),
  "app.maintenanceMessage": bilingual("general", { fr: "Akinaza est en maintenance. Revenez dans quelques minutes.", en: "Akinaza is down for maintenance. Please come back in a few minutes." }),
  // API keys (#178): the global switch, what a plan holds, the pace of one key.
  "features.apiKeys": flag("features", true, WORKSPACE_SCOPES),
  "features.webhooks": flag("features", true, WORKSPACE_SCOPES),
  "features.shopWall": flag("features", false),
  "features.shopReels": flag("features", false),
  "features.shopFollow": flag("features", false),
  "features.shopReviews": flag("features", false),
  "features.shopAnnouncements": flag("features", false),
  "plans.free.apiKeys": integer("plans", 2, { min: 0, max: 100, unit: "keys" }, WORKSPACE_SCOPES),
  "plans.paid.apiKeys": integer("plans", 10, { min: 0, max: 100, unit: "keys" }, WORKSPACE_SCOPES),
  "limits.apiRequestsPerMinute": integer("limits", 120, { min: 1, max: 6000, unit: "requests" }, WORKSPACE_SCOPES),
  // Invoice e-mails (#229): the most one shop sends per day (UTC), whatever the clients.
  "limits.invoiceEmailsPerShopPerDay": integer("limits", 50, { min: 1, max: 10000, unit: "e-mails" }, GLOBAL_ONLY),
  "limits.webhookEndpoints": integer("limits", 5, { min: 0, max: 50, unit: "endpoints" }, WORKSPACE_SCOPES),
  "limits.wallItems": integer("limits", 24, { min: 1, max: 500, unit: "items" }),
  "limits.reelSeconds": integer("limits", 60, { min: 1, max: 300, unit: "seconds" }),
  "limits.reelMegabytes": integer("limits", 40, { min: 1, max: 500, unit: "megabytes" }),
  // The shop page in other languages (#258): off until the Orazaka Studio is wired; the languages the owner may turn on; the runs per shop and day.
  "features.storefrontTranslation": flag("features", false, GLOBAL_ONLY),
  "storefront.languages.allowed": subset("storefront", ["fr", "en", "es"] as const, ["fr", "en", "es"], GLOBAL_ONLY),
  "limits.translationsPerShopPerDay": integer("limits", 20, { min: 1, max: 500, unit: "runs" }, GLOBAL_ONLY),
  "realtime.storefront.enabled": flag("realtime", true, GLOBAL_ONLY),
  "realtime.storefront.heartbeatSeconds": integer("realtime", 15, { min: 5, max: 60, unit: "seconds" }, GLOBAL_ONLY),
  "realtime.storefront.maxStreamsPerPage": integer("realtime", 100, { min: 1, max: 1000, unit: "streams" }, GLOBAL_ONLY),
} as const;

export const settings = defineSettings(SETTINGS);
export type SettingKey = keyof typeof SETTINGS;

/** One instance per process, shared by every bundle: a change made in a route is seen by the next page at once. */
const holder = globalThis as unknown as { __akinazaSettings?: SettingsService<typeof SETTINGS> };

export function appSettings(): SettingsService<typeof SETTINGS> {
  holder.__akinazaSettings ??= postgresSettings(settings, { query: async (sql, params) => query(sql, params as unknown[]) as never, clock: () => performance.now() });
  return holder.__akinazaSettings;
}

/** For tests: forget the cached service. */
export const resetAppSettings = () => {
  holder.__akinazaSettings = undefined;
};

export async function shopSectionFeatures(): Promise<Record<"wall" | "reels" | "follow" | "reviews" | "announcements", boolean>> {
  const service = appSettings();
  const options = { userId: null };
  const [wall, reels, follow, reviews, announcements] = await Promise.all([
    service.get("features.shopWall", options),
    service.get("features.shopReels", options),
    service.get("features.shopFollow", options),
    service.get("features.shopReviews", options),
    service.get("features.shopAnnouncements", options),
  ]);
  return { wall, reels, follow, reviews, announcements };
}

/** The features that can be switched off: the server refuses what is off, whatever the browser shows. */
export const FEATURE = { apiKeys: "features.apiKeys", webhooks: "features.webhooks" } as const satisfies Record<string, SettingKey>;
export type Feature = keyof typeof FEATURE;

/** 403 FEATURE_OFF when the feature is switched off for this person. */
export async function assertFeature(feature: Feature, userId: string | null): Promise<void> {
  if (!(await appSettings().get(FEATURE[feature], { userId }))) throw refuse(403, "FEATURE_OFF", "This feature is switched off", { feature });
}

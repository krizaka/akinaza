import { type ScoreRules } from "@akinaza/core";

import { refuse } from "@/lib/http";
import { appSettings, type SettingKey } from "@/lib/settings";

/** The switches of the shop-as-a-place features (`features.shop*`): the server refuses what is off, whatever the browser shows. */
export async function assertShopFeature(feature: Extract<SettingKey, `features.shop${string}`>): Promise<void> {
  if (!(await appSettings().get(feature, { userId: null }))) throw refuse(403, "FEATURE_OFF", "This feature is switched off", { feature });
}

/** The administrator's reviews rules: the minimum before a score is shown, the prior mean and its weight (the Bayesian score). */
export async function reviewRules(): Promise<ScoreRules> {
  const settings = appSettings();
  const options = { userId: null };
  const [minCount, priorTenths, weight] = await Promise.all([settings.get("reviews.minCount", options), settings.get("reviews.priorTenths", options), settings.get("reviews.priorWeight", options)]);
  return { minCount, prior: priorTenths / 10, weight };
}

/** The wall's bounds as the administrator set them: how many items it holds, and the reel's duration and size. */
export async function communityLimits(): Promise<{ wallItems: number; reelSeconds: number; reelMegabytes: number }> {
  const settings = appSettings();
  const options = { userId: null };
  const [wallItems, reelSeconds, reelMegabytes] = await Promise.all([settings.get("limits.wallItems", options), settings.get("limits.reelSeconds", options), settings.get("limits.reelMegabytes", options)]);
  return { wallItems, reelSeconds, reelMegabytes };
}

// @fixed: a megabyte is 2^20 bytes (the administrator's `limits.reelMegabytes`).
const BYTES_PER_MEGABYTE = 1024 * 1024;
export const megabytesToBytes = (megabytes: number): number => megabytes * BYTES_PER_MEGABYTE;

import { SHOP_TYPES } from "@akinaza/core";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "./client";
import { shopPage } from "./schema";

export const SHOP_PAGE_SECTIONS = ["services", "team", "hours", "zones", "gallery", "wall", "reels", "announcements", "reviews", "follow"] as const;
export type ShopPageSection = (typeof SHOP_PAGE_SECTIONS)[number];
export interface ShopPageSectionSetting {
  id: ShopPageSection;
  visible: boolean;
}

export const DEFAULT_SHOP_PAGE_SECTIONS: readonly ShopPageSectionSetting[] = SHOP_PAGE_SECTIONS.map((id) => ({ id, visible: true }));
const sectionsSchema = z.array(z.object({ id: z.enum(SHOP_PAGE_SECTIONS), visible: z.boolean() })).length(SHOP_PAGE_SECTIONS.length).superRefine((sections, ctx) => {
  const ids = sections.map((section) => section.id);
  if (new Set(ids).size !== SHOP_PAGE_SECTIONS.length || SHOP_PAGE_SECTIONS.some((id) => !ids.includes(id))) {
    ctx.addIssue({ code: "custom", message: "Every storefront section must occur exactly once" });
  }
});

export const shopPageConfigSchema = z.object({
  sections: sectionsSchema,
  logoUrl: z.string().trim().url().max(500).refine((url) => url.startsWith("https://"), { message: "https only" }).nullable(),
  /** The trade the owner chose (picks the default images); null: from the business type. Omitted on a save = unchanged. */
  shopType: z.enum(SHOP_TYPES).nullable().optional(),
  /** Whether the page shows the proposed images where the owner has none. Omitted on a save = unchanged. */
  useDefaults: z.boolean().optional(),
});
export type ShopPageConfig = z.infer<typeof shopPageConfigSchema>;

export function defaultShopPageConfig(): ShopPageConfig {
  return { sections: DEFAULT_SHOP_PAGE_SECTIONS.map((section) => ({ ...section })), logoUrl: null, shopType: null, useDefaults: true };
}

export async function shopPageConfigOf(db: Db, shopId: string): Promise<ShopPageConfig> {
  const [row] = await db.select().from(shopPage).where(eq(shopPage.shopId, shopId));
  return row ? shopPageConfigSchema.parse({ sections: row.sections, logoUrl: row.logoUrl, shopType: row.shopType, useDefaults: row.useDefaults }) : defaultShopPageConfig();
}

/** What a save may carry: any part of the configuration. What it does not name stays as it was (the look card and the images card each save their own part). */
export const shopPageSaveSchema = shopPageConfigSchema.partial();
export type ShopPageSave = z.infer<typeof shopPageSaveSchema>;

export async function saveShopPageConfig(db: Db, shopId: string, input: unknown): Promise<void> {
  const named = Object.fromEntries(Object.entries(shopPageSaveSchema.parse(input)).filter(([, value]) => value !== undefined)) as ShopPageSave;
  const fresh = defaultShopPageConfig();
  await db.insert(shopPage).values({ shopId, ...fresh, ...named }).onConflictDoUpdate({
    target: shopPage.shopId,
    set: { ...named, updatedAt: sql`now()` },
  });
}

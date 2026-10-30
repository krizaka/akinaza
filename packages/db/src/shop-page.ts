import { framePaperOf, SHOP_TYPES, TEMPLATES, type Template } from "@akinaza/core";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "./client";
import { ShopError } from "./errors";
import { shopPage } from "./schema";

/** `trust` (story, contact, policies) is orderable since #261; before, it was injected just before `gallery`, and pages saved then are read with it there (`withTrust`). */
export const SHOP_PAGE_SECTIONS = ["services", "team", "hours", "zones", "trust", "gallery", "wall", "reels", "announcements", "reviews", "follow"] as const;
export type ShopPageSection = (typeof SHOP_PAGE_SECTIONS)[number];
export interface ShopPageSectionSetting {
  id: ShopPageSection;
  visible: boolean;
}

export const DEFAULT_SHOP_PAGE_SECTIONS: readonly ShopPageSectionSetting[] = SHOP_PAGE_SECTIONS.map((id) => ({ id, visible: true }));
/** A stored list that predates `trust` (ten sections) is read with it at today's placement - right before `gallery` (at the end without one): no page changes. */
export function withTrust<T extends { id: string; visible: boolean }>(sections: readonly T[]): (T | { id: "trust"; visible: boolean })[] {
  if (sections.some((section) => section.id === "trust")) return [...sections];
  const at = sections.findIndex((section) => section.id === "gallery");
  const out: (T | { id: "trust"; visible: boolean })[] = [...sections];
  out.splice(at < 0 ? out.length : at, 0, { id: "trust", visible: true });
  return out;
}
const legacyAware = (value: unknown) => (Array.isArray(value) && value.every((x) => x && typeof x === "object" && "id" in x) ? withTrust(value as { id: string; visible: boolean }[]) : value);

const sectionsSchema = z.preprocess(legacyAware, z.array(z.object({ id: z.enum(SHOP_PAGE_SECTIONS), visible: z.boolean() })).length(SHOP_PAGE_SECTIONS.length).superRefine((sections, ctx) => {
  const ids = sections.map((section) => section.id);
  if (new Set(ids).size !== SHOP_PAGE_SECTIONS.length || SHOP_PAGE_SECTIONS.some((id) => !ids.includes(id))) {
    ctx.addIssue({ code: "custom", message: "Every storefront section must occur exactly once" });
  }
}));

export const shopPageConfigSchema = z.object({
  sections: sectionsSchema,
  logoUrl: z.string().trim().url().max(500).refine((url) => url.startsWith("https://"), { message: "https only" }).nullable(),
  /** The logo for the dark theme (akinaza#597); null = the same logo on both. */
  logoDarkUrl: z.string().trim().url().max(500).refine((url) => url.startsWith("https://"), { message: "https only" }).nullable().optional(),
  /** The trade the owner chose (picks the default images); null: from the business type. Omitted on a save = unchanged. */
  shopType: z.enum(SHOP_TYPES).nullable().optional(),
  /** Whether the page shows the proposed images where the owner has none. Omitted on a save = unchanged. */
  useDefaults: z.boolean().optional(),
  /** Read-only here: the template the owner applied (changed only by `applyTemplate`) and whether the owner has customised the sections. A save ignores them. */
  templateId: z.string().nullable().optional(),
  templateVersion: z.number().int().nullable().optional(),
  sectionsCustom: z.boolean().optional(),
});
export type ShopPageConfig = z.infer<typeof shopPageConfigSchema>;

export function defaultShopPageConfig(): ShopPageConfig {
  return { sections: DEFAULT_SHOP_PAGE_SECTIONS.map((section) => ({ ...section })), logoUrl: null, logoDarkUrl: null, shopType: null, useDefaults: true, templateId: null, templateVersion: null, sectionsCustom: false };
}

export async function shopPageConfigOf(db: Db, shopId: string): Promise<ShopPageConfig> {
  const [row] = await db.select().from(shopPage).where(eq(shopPage.shopId, shopId));
  return row ? shopPageConfigSchema.parse({ sections: row.sections, logoUrl: row.logoUrl, logoDarkUrl: row.logoDarkUrl, shopType: row.shopType, useDefaults: row.useDefaults, templateId: row.templateId, templateVersion: row.templateVersion, sectionsCustom: row.sectionsCustom }) : defaultShopPageConfig();
}

/** What a save may carry: any part of the configuration but the template and the custom flag (`applyTemplate` owns them; sent anyway, they are dropped). What it does not name stays as it was (the look card and the images card each save their own part). */
export const shopPageSaveSchema = shopPageConfigSchema.omit({ templateId: true, templateVersion: true, sectionsCustom: true }).partial();
export type ShopPageSave = z.infer<typeof shopPageSaveSchema>;

const sameSections = (a: readonly { id: string; visible: boolean }[], b: readonly { id: string; visible: boolean }[]) => a.length === b.length && a.every((x, i) => x.id === b[i]!.id && x.visible === b[i]!.visible);

export async function saveShopPageConfig(db: Db, shopId: string, input: unknown): Promise<void> {
  const named = Object.fromEntries(Object.entries(shopPageSaveSchema.parse(input)).filter(([, value]) => value !== undefined)) as ShopPageSave;
  const fresh = defaultShopPageConfig();
  // The owner's own order or visibility, once changed by hand, is theirs: a template asks before replacing it (#261). Only a save that names the sections can change that.
  let custom: { sectionsCustom: boolean } | Record<never, never> = {};
  if (named.sections) {
    const [existing] = await db.select({ sections: shopPage.sections, custom: shopPage.sectionsCustom }).from(shopPage).where(eq(shopPage.shopId, shopId));
    const before = existing ? withTrust(existing.sections) : DEFAULT_SHOP_PAGE_SECTIONS;
    custom = { sectionsCustom: (existing?.custom ?? false) || !sameSections(before, named.sections) };
  }
  await db.insert(shopPage).values({ shopId, ...fresh, ...named, ...custom }).onConflictDoUpdate({
    target: shopPage.shopId,
    set: { ...named, ...custom, updatedAt: sql`now()` },
  });
}

/** The sections a template lists, in its order, then the others as they are (their order and visibility kept): what the page becomes when a template's order is applied. */
export function sectionsFromTemplate(template: Template, current: readonly ShopPageSectionSetting[]): ShopPageSectionSetting[] {
  const known = new Set<string>(SHOP_PAGE_SECTIONS);
  const listed = template.sections.filter((s) => known.has(s.id)).map((s) => ({ id: s.id as ShopPageSection, visible: s.visible }));
  return [...listed, ...current.filter((c) => !listed.some((l) => l.id === c.id))];
}

/**
 * The owner applies a template (#261): the shop keeps the template's id and version; its section order is replaced by the template's unless the owner chose to keep theirs.
 * A page the owner customised by hand never has its order replaced silently: `keepOrder` must then be said (`AK_SECTIONS_CUSTOM`). Nothing else of the shop changes: texts, media and
 * translations are not part of a template. An id or version the catalogue (or the administrator's offered list) does not hold is the answer of an unknown template.
 */
export async function applyTemplate(db: Db, shopId: string, input: { templateId: string; templateVersion?: number; keepOrder?: boolean; offered?: readonly string[] }, catalogue: readonly Template[] = TEMPLATES): Promise<Template> {
  const candidates = catalogue.filter((t) => t.id === input.templateId && (input.templateVersion === undefined || t.version === input.templateVersion)).sort((a, b) => b.version - a.version);
  const template = candidates[0];
  if (!template || (input.offered && !input.offered.includes(template.id))) throw new ShopError("AK_TEMPLATE_UNKNOWN", "AK_TEMPLATE_UNKNOWN");
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(shopPage).where(eq(shopPage.shopId, shopId)).for("update");
    const custom = row?.sectionsCustom ?? false;
    if (custom && input.keepOrder === undefined) throw new ShopError("AK_SECTIONS_CUSTOM", "AK_SECTIONS_CUSTOM");
    const keep = input.keepOrder === true;
    const stored = row ? withTrust(row.sections) : null;
    const kept = stored ?? DEFAULT_SHOP_PAGE_SECTIONS.map((s) => ({ ...s }));
    const sections = keep ? kept : sectionsFromTemplate(template, (stored ?? DEFAULT_SHOP_PAGE_SECTIONS) as ShopPageSectionSetting[]);
    const values = { sections, templateId: template.id, templateVersion: template.version, sectionsCustom: keep ? custom : false, paper: framePaperOf(template.paper) };
    await tx.insert(shopPage).values({ shopId, ...values }).onConflictDoUpdate({ target: shopPage.shopId, set: { ...values, updatedAt: sql`now()` } });
    return template;
  });
}

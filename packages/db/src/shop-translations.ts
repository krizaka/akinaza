import { createHash } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "./client";
import { ShopError } from "./errors";
import { services, shopLanguages, shops, shopTranslationRuns, shopTranslations } from "./schema";

/** The languages a shop page can speak. The source (the language the owner writes in) is French or English; Spanish is offered, never the source. */
export const PAGE_LOCALES = ["fr", "en", "es"] as const;
export type PageLocale = (typeof PAGE_LOCALES)[number];
export const SOURCE_LOCALES = ["fr", "en"] as const;
export type SourceLocale = (typeof SOURCE_LOCALES)[number];

/** A translation's status: made by the port (`auto`) or written by the owner (`edited`). */
export const TRANSLATION_STATUS = { auto: "auto", edited: "edited" } as const;
/** Where a translated text belongs. */
export const TRANSLATION_KIND = { shop: "shop", service: "service" } as const;
export const TRANSLATION_FIELDS = { shop: ["tagline", "bio"], service: ["name", "description", "included"] } as const;
export type TranslationKind = keyof typeof TRANSLATION_FIELDS;
export interface FieldRef {
  kind: TranslationKind;
  /** The shop's id for a `shop` field, the service's id for a `service` field. */
  refId: string;
  field: string;
}
/** A field's key, `kind:refId:field`: how the page, the owner's screen and the port name the same text. */
export const fieldKey = (f: FieldRef) => `${f.kind}:${f.refId}:${f.field}`;
export function parseFieldKey(key: string): FieldRef | null {
  const [kind, refId, field, extra] = key.split(":");
  if (extra !== undefined || (kind !== "shop" && kind !== "service") || !z.string().uuid().safeParse(refId).success) return null;
  return (TRANSLATION_FIELDS[kind] as readonly string[]).includes(field ?? "") ? { kind, refId: refId!, field: field! } : null;
}

/** The version of a source text: a changed source makes the translations made from the old one stale. */
export const sourceHash = (text: string) => createHash("sha256").update(text.trim()).digest("hex").slice(0, 12);

export interface ShopLanguages {
  source: SourceLocale;
  /** The languages offered, the source included. */
  enabled: PageLocale[];
}
export const DEFAULT_LANGUAGES: ShopLanguages = { source: "fr", enabled: ["fr", "en"] };

export async function shopLanguagesOf(db: Db, shopId: string): Promise<ShopLanguages> {
  const [row] = await db.select().from(shopLanguages).where(eq(shopLanguages.shopId, shopId));
  return row ? { source: row.sourceLocale, enabled: row.enabled.filter((l): l is PageLocale => (PAGE_LOCALES as readonly string[]).includes(l)) } : { ...DEFAULT_LANGUAGES, enabled: [...DEFAULT_LANGUAGES.enabled] };
}

const languagesSchema = z.object({ source: z.enum(SOURCE_LOCALES), enabled: z.array(z.enum(PAGE_LOCALES)).max(3) });

/**
 * The owner's choice, inside what the administrator allows: the source is always offered, every other language must be in `allowed`.
 * A language that is already on and no longer allowed is switched off (the page falls back to the source language).
 */
export async function saveShopLanguages(db: Db, shopId: string, input: unknown, allowed: readonly PageLocale[]): Promise<ShopLanguages> {
  const parsed = languagesSchema.parse(input);
  const enabled = PAGE_LOCALES.filter((l) => l === parsed.source || (parsed.enabled.includes(l) && allowed.includes(l)));
  const refused = parsed.enabled.filter((l) => l !== parsed.source && !allowed.includes(l));
  if (refused.length) throw new ShopError("AK_LANGUAGE_NOT_ALLOWED", `AK_LANGUAGE_NOT_ALLOWED: ${refused.join(",")}`);
  await db.insert(shopLanguages).values({ shopId, sourceLocale: parsed.source, enabled }).onConflictDoUpdate({ target: shopLanguages.shopId, set: { sourceLocale: parsed.source, enabled, updatedAt: sql`now()` } });
  return { source: parsed.source, enabled };
}

export interface TranslatableField extends FieldRef {
  key: string;
  /** The text in the source language (never empty: an empty field is not offered). */
  source: string;
  sourceHash: string;
  /** What the owner wrote by hand in French and in English (the shop's own columns): never overwritten by a translation. */
  own: Partial<Record<SourceLocale, string>>;
  /** For a service field, the service's name in the source language (to tell the fields apart on the owner's screen). */
  owner: string | null;
}

const clean = (value: string | null | undefined) => (value ?? "").trim();

/** The page's texts the owner can have translated, read in the source language. The shop name, the service names' brand part, the area and the street address are a glossary: they are never sent for translation. */
export async function translatableFields(db: Db, shopId: string, source: SourceLocale): Promise<TranslatableField[]> {
  const [shop] = await db.select({ taglineFr: shops.taglineFr, taglineEn: shops.taglineEn, bioFr: shops.bioFr, bioEn: shops.bioEn }).from(shops).where(eq(shops.id, shopId));
  if (!shop) return [];
  const rows = await db.select().from(services).where(and(eq(services.shopId, shopId), eq(services.active, true)));
  const out: TranslatableField[] = [];
  const add = (ref: FieldRef, own: Record<SourceLocale, string>, owner: string | null) => {
    const text = own[source];
    if (text) out.push({ ...ref, key: fieldKey(ref), source: text, sourceHash: sourceHash(text), own: Object.fromEntries(SOURCE_LOCALES.filter((l) => own[l]).map((l) => [l, own[l]])), owner });
  };
  add({ kind: "shop", refId: shopId, field: "tagline" }, { fr: clean(shop.taglineFr), en: clean(shop.taglineEn) }, null);
  add({ kind: "shop", refId: shopId, field: "bio" }, { fr: clean(shop.bioFr), en: clean(shop.bioEn) }, null);
  for (const s of rows) {
    const owner = source === "fr" ? s.nameFr : s.nameEn;
    add({ kind: "service", refId: s.id, field: "name" }, { fr: clean(s.nameFr), en: clean(s.nameEn) }, null);
    add({ kind: "service", refId: s.id, field: "description" }, { fr: clean(s.descriptionFr), en: clean(s.descriptionEn) }, owner);
    add({ kind: "service", refId: s.id, field: "included" }, { fr: s.includedFr.join("\n").trim(), en: s.includedEn.join("\n").trim() }, owner);
  }
  return out;
}

export interface StoredTranslation {
  key: string;
  locale: PageLocale;
  text: string;
  status: "auto" | "edited";
  runId: string | null;
  sourceHash: string;
}

export async function translationsOf(db: Db, shopId: string): Promise<StoredTranslation[]> {
  const rows = await db.select().from(shopTranslations).where(eq(shopTranslations.shopId, shopId));
  return rows.map((r) => ({ key: fieldKey({ kind: r.kind, refId: r.refId, field: r.field }), locale: r.locale, text: r.text, status: r.status, runId: r.runId, sourceHash: r.sourceHash }));
}

/** A field of this shop: a service field needs the service to belong to the shop (a foreign id is the answer of an unknown one). */
async function assertOwned(db: Db, shopId: string, ref: FieldRef): Promise<void> {
  if (ref.kind === TRANSLATION_KIND.shop) {
    if (ref.refId !== shopId) throw new ShopError("AK_TRANSLATION_UNKNOWN", "AK_TRANSLATION_UNKNOWN");
    return;
  }
  const [row] = await db.select({ id: services.id }).from(services).where(and(eq(services.id, ref.refId), eq(services.shopId, shopId)));
  if (!row) throw new ShopError("AK_TRANSLATION_UNKNOWN", "AK_TRANSLATION_UNKNOWN");
}

/**
 * Stores what a translation run returned. A text the owner edited is never overwritten unless `overwriteEdited` names it (the owner asked to redo it).
 * Returns the keys stored and the keys skipped because the owner had edited them.
 */
export async function storeAutoTranslations(db: Db, shopId: string, locale: PageLocale, runId: string, rows: { key: string; text: string; sourceHash: string }[], overwriteEdited: ReadonlySet<string> = new Set()): Promise<{ stored: string[]; skippedEdited: string[] }> {
  const stored: string[] = [];
  const skippedEdited: string[] = [];
  await db.transaction(async (tx) => {
    for (const row of rows) {
      const ref = parseFieldKey(row.key);
      if (!ref) throw new ShopError("AK_TRANSLATION_UNKNOWN", "AK_TRANSLATION_UNKNOWN");
      await assertOwned(tx as unknown as Db, shopId, ref);
      const text = row.text.trim().slice(0, 2000);
      if (!text) continue;
      const [existing] = await tx.select({ status: shopTranslations.status }).from(shopTranslations).where(and(eq(shopTranslations.shopId, shopId), eq(shopTranslations.kind, ref.kind), eq(shopTranslations.refId, ref.refId), eq(shopTranslations.field, ref.field), eq(shopTranslations.locale, locale)));
      if (existing?.status === TRANSLATION_STATUS.edited && !overwriteEdited.has(row.key)) {
        skippedEdited.push(row.key);
        continue;
      }
      await tx
        .insert(shopTranslations)
        .values({ shopId, kind: ref.kind, refId: ref.refId, field: ref.field, locale, text, status: TRANSLATION_STATUS.auto, runId, sourceHash: row.sourceHash })
        .onConflictDoUpdate({ target: [shopTranslations.shopId, shopTranslations.kind, shopTranslations.refId, shopTranslations.field, shopTranslations.locale], set: { text, status: "auto", runId, sourceHash: row.sourceHash, updatedAt: sql`now()` } });
      stored.push(row.key);
    }
  });
  return { stored, skippedEdited };
}

/** The owner's own wording of a translation: it becomes `edited` and keeps the source version it was written against. */
export async function saveEditedTranslation(db: Db, shopId: string, locale: PageLocale, key: string, text: string, currentSourceHash: string): Promise<void> {
  const ref = parseFieldKey(key);
  const value = text.trim();
  if (!ref || !value || value.length > 2000) throw new ShopError("AK_TRANSLATION_UNKNOWN", "AK_TRANSLATION_UNKNOWN");
  await assertOwned(db, shopId, ref);
  await db
    .insert(shopTranslations)
    .values({ shopId, kind: ref.kind, refId: ref.refId, field: ref.field, locale, text: value, status: "edited", runId: null, sourceHash: currentSourceHash })
    .onConflictDoUpdate({ target: [shopTranslations.shopId, shopTranslations.kind, shopTranslations.refId, shopTranslations.field, shopTranslations.locale], set: { text: value, status: "edited", sourceHash: currentSourceHash, updatedAt: sql`now()` } });
}

/** Removes the translations of a language (the owner switched it off for good). */
export async function removeTranslationsOfLocale(db: Db, shopId: string, locale: PageLocale): Promise<void> {
  await db.delete(shopTranslations).where(and(eq(shopTranslations.shopId, shopId), eq(shopTranslations.locale, locale)));
}

/** Takes one translation run of the day, atomically: false when the shop already used its `limit`. */
export async function reserveTranslationRun(db: Db, shopId: string, day: string, limit: number): Promise<boolean> {
  if (limit <= 0) return false;
  const result = await db.execute(sql`
    INSERT INTO shop_translation_runs (shop_id, day, runs) VALUES (${shopId}, ${day}, 1)
    ON CONFLICT (shop_id, day) DO UPDATE SET runs = shop_translation_runs.runs + 1 WHERE shop_translation_runs.runs < ${limit}
    RETURNING runs`);
  return result.rows.length > 0;
}

/** Gives back a run the port did not answer (the owner is not charged a run for a failure). */
export async function releaseTranslationRun(db: Db, shopId: string, day: string): Promise<void> {
  await db.execute(sql`UPDATE shop_translation_runs SET runs = runs - 1 WHERE shop_id = ${shopId} AND day = ${day} AND runs > 0`);
}

export async function translationRunsOn(db: Db, shopId: string, day: string): Promise<number> {
  const [row] = await db.select({ runs: shopTranslationRuns.runs }).from(shopTranslationRuns).where(and(eq(shopTranslationRuns.shopId, shopId), eq(shopTranslationRuns.day, day)));
  return row?.runs ?? 0;
}

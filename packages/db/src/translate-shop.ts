
import { and, eq } from "drizzle-orm";

import type { Db } from "./client";
import { ShopError } from "./errors";
import { services, shops } from "./schema";
import { fieldKey, type PageLocale, releaseTranslationRun, reserveTranslationRun, shopLanguagesOf, SOURCE_LOCALES, storeAutoTranslations, TRANSLATION_STATUS, type StoredTranslation, type TranslatableField, translatableFields, translationsOf } from "./shop-translations";
import type { TranslationPort } from "./translation-port";

/** What a field's translation in a language is, for the owner's screen and for the run. */
export type TranslationState = "own" | "missing" | "auto" | "edited" | "stale";

export interface FieldView {
  key: string;
  kind: "shop" | "service";
  field: string;
  owner: string | null;
  source: string;
  languages: Partial<Record<PageLocale, { state: TranslationState; text: string }>>;
}

/** The state of one translation: stale when the source text changed since it was made (« à revoir », whatever its status). */
export function stateOf(field: TranslatableField, locale: PageLocale, stored: StoredTranslation | undefined): { state: TranslationState; text: string } {
  const own = (SOURCE_LOCALES as readonly string[]).includes(locale) ? field.own[locale as "fr" | "en"] : undefined;
  if (own) return { state: "own", text: own }; // written by the owner in this language: the page uses it, the screen shows it, a translation never replaces it
  if (stored) return { state: stored.sourceHash !== field.sourceHash ? "stale" : stored.status, text: stored.text };
  return { state: "missing", text: "" };
}

/** The screen's rows: every text, with its state in each language the owner offers (the source language is the text itself). */
export async function translationRows(db: Db, shopId: string): Promise<{ source: string; enabled: PageLocale[]; fields: FieldView[] }> {
  const languages = await shopLanguagesOf(db, shopId);
  const [fields, stored] = await Promise.all([translatableFields(db, shopId, languages.source), translationsOf(db, shopId)]);
  const byKey = new Map(stored.map((s) => [`${s.key}|${s.locale}`, s]));
  return {
    source: languages.source,
    enabled: languages.enabled,
    fields: fields.map((f) => ({
      key: f.key,
      kind: f.kind,
      field: f.field,
      owner: f.owner,
      source: f.source,
      languages: Object.fromEntries(languages.enabled.filter((l) => l !== languages.source).map((l) => [l, stateOf(f, l, byKey.get(`${f.key}|${l}`))])),
    })),
  };
}

export interface RunInput {
  shopId: string;
  locale: PageLocale;
  /** The day (UTC) the daily limit counts. */
  day: string;
  dailyLimit: number;
  /** Texts the owner asked to redo even though they edited them. */
  redo?: readonly string[];
}

/** The shop's glossary: names that stay as written in every language. */
async function glossaryOf(db: Db, shopId: string): Promise<string[]> {
  const [shop] = await db.select({ name: shops.name, area: shops.area, address: shops.address }).from(shops).where(eq(shops.id, shopId));
  const names = await db.select({ fr: services.nameFr, en: services.nameEn }).from(services).where(and(eq(services.shopId, shopId), eq(services.active, true)));
  return [...new Set([shop?.name, shop?.area, shop?.address, ...names.flatMap((n) => [n.fr, n.en])].filter((x): x is string => !!x?.trim()))];
}

/**
 * « Traduire »: what is missing or stale in one language, through the port, once per run of the day. A text the owner wrote by hand in that
 * language (the shop's own French or English) and a text the owner edited are never sent and never overwritten, unless `redo` names the edited one.
 */
export async function translateShop(db: Db, port: TranslationPort, input: RunInput): Promise<{ runId: string | null; stored: string[]; skippedEdited: string[]; nothingToDo: boolean }> {
  const languages = await shopLanguagesOf(db, input.shopId);
  if (input.locale === languages.source || !languages.enabled.includes(input.locale)) throw new ShopError("AK_LANGUAGE_NOT_ENABLED", "AK_LANGUAGE_NOT_ENABLED");
  const fields = await translatableFields(db, input.shopId, languages.source);
  const stored = new Map((await translationsOf(db, input.shopId)).filter((s) => s.locale === input.locale).map((s) => [s.key, s]));
  const redo = new Set(input.redo ?? []);
  const todo = fields.filter((f) => {
    const s = stored.get(f.key);
    if (redo.has(f.key)) return true;
    if (s) return s.status === TRANSLATION_STATUS.auto && s.sourceHash !== f.sourceHash; // an edited text waits for the owner's decision
    return !(SOURCE_LOCALES as readonly string[]).includes(input.locale) || !f.own[input.locale as "fr" | "en"];
  });
  if (!todo.length) return { runId: null, stored: [], skippedEdited: [], nothingToDo: true };
  if (!(await reserveTranslationRun(db, input.shopId, input.day, input.dailyLimit))) throw new ShopError("AK_TRANSLATION_LIMIT", "AK_TRANSLATION_LIMIT");
  let result;
  try {
    result = await port.translate({ from: languages.source, to: input.locale, glossary: await glossaryOf(db, input.shopId), texts: todo.map((f) => ({ key: f.key, text: f.source })) });
  } catch (error) {
    await releaseTranslationRun(db, input.shopId, input.day);
    throw error;
  }
  const byKey = new Map(todo.map((f) => [f.key, f]));
  const rows = result.texts.filter((t) => byKey.has(t.key)).map((t) => ({ key: t.key, text: t.text, sourceHash: byKey.get(t.key)!.sourceHash }));
  const out = await storeAutoTranslations(db, input.shopId, input.locale, result.runId, rows, redo);
  return { runId: result.runId, ...out, nothingToDo: false };
}

export { fieldKey };

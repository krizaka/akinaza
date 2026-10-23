import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { shops } from "./schema";
import { DEFAULT_LANGUAGES, fieldKey, parseFieldKey, removeTranslationsOfLocale, reserveTranslationRun, saveEditedTranslation, saveShopLanguages, shopLanguagesOf, sourceHash, storeAutoTranslations, translatableFields, translationsOf } from "./shop-translations";
import { freshDatabase } from "./test/db";
import { salon } from "./test/fixtures";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

const withTexts = async () => {
  const s = await salon(t.db);
  await t.db.update(shops).set({ taglineFr: "Coiffure de quartier", bioFr: "Julie et Marc vous reçoivent depuis 2012.", taglineEn: "Neighbourhood hair" }).where(eq(shops.id, s.shop.id));
  return s;
};

describe("the languages of a shop page", () => {
  it("default to French source, French and English", async () => {
    const s = await salon(t.db);
    expect(await shopLanguagesOf(t.db, s.shop.id)).toEqual(DEFAULT_LANGUAGES);
  });

  it("keep the source on, take only what the administrator allows, and refuse the rest", async () => {
    const s = await salon(t.db);
    expect(await saveShopLanguages(t.db, s.shop.id, { source: "fr", enabled: ["en", "es"] }, ["fr", "en", "es"])).toEqual({ source: "fr", enabled: ["fr", "en", "es"] });
    expect(await shopLanguagesOf(t.db, s.shop.id)).toEqual({ source: "fr", enabled: ["fr", "en", "es"] });
    await expect(saveShopLanguages(t.db, s.shop.id, { source: "fr", enabled: ["es"] }, ["fr", "en"])).rejects.toMatchObject({ code: "AK_LANGUAGE_NOT_ALLOWED" });
    expect(await saveShopLanguages(t.db, s.shop.id, { source: "en", enabled: [] }, ["fr", "en"])).toEqual({ source: "en", enabled: ["en"] });
    await expect(saveShopLanguages(t.db, s.shop.id, { source: "es", enabled: ["es"] }, ["fr", "en", "es"])).rejects.toThrow();
  });
});

describe("what can be translated", () => {
  it("reads the texts in the source language, with a version, and never offers an empty one or the shop name", async () => {
    const s = await withTexts();
    const fields = await translatableFields(t.db, s.shop.id, "fr");
    const keys = fields.map((f) => f.key);
    expect(keys).toContain(fieldKey({ kind: "shop", refId: s.shop.id, field: "tagline" }));
    expect(keys).toContain(fieldKey({ kind: "service", refId: s.services.cut.id, field: "name" }));
    expect(keys.some((k) => k.endsWith(":description"))).toBe(false); // empty: not offered
    const tagline = fields.find((f) => f.field === "tagline")!;
    expect(tagline).toMatchObject({ source: "Coiffure de quartier", sourceHash: sourceHash("Coiffure de quartier"), own: { fr: "Coiffure de quartier", en: "Neighbourhood hair" } });
    expect(JSON.stringify(fields)).not.toContain("Salon Laurier");
  });

  it("parses only well-formed keys", () => {
    expect(parseFieldKey("shop:00000000-0000-4000-8000-000000000000:bio")).not.toBeNull();
    for (const bad of ["shop:x:bio", "client:00000000-0000-4000-8000-000000000000:name", "shop:00000000-0000-4000-8000-000000000000:phone", "a:b"]) expect(parseFieldKey(bad)).toBeNull();
  });
});

describe("the translations", () => {
  it("are stored with their run and the version of their source, and read back", async () => {
    const s = await withTexts();
    const key = fieldKey({ kind: "shop", refId: s.shop.id, field: "bio" });
    const out = await storeAutoTranslations(t.db, s.shop.id, "es", "run-1", [{ key, text: "Julie y Marc le reciben desde 2012.", sourceHash: sourceHash("Julie et Marc vous reçoivent depuis 2012.") }]);
    expect(out).toEqual({ stored: [key], skippedEdited: [] });
    expect(await translationsOf(t.db, s.shop.id)).toEqual([{ key, locale: "es", text: "Julie y Marc le reciben desde 2012.", status: "auto", runId: "run-1", sourceHash: sourceHash("Julie et Marc vous reçoivent depuis 2012.") }]);
  });

  it("an edited text is never overwritten by a run, unless the owner asked to redo that one", async () => {
    const s = await withTexts();
    const key = fieldKey({ kind: "shop", refId: s.shop.id, field: "tagline" });
    const hash = sourceHash("Coiffure de quartier");
    await storeAutoTranslations(t.db, s.shop.id, "es", "run-1", [{ key, text: "Peluquería de barrio", sourceHash: hash }]);
    await saveEditedTranslation(t.db, s.shop.id, "es", key, "Peluquería del barrio", hash);
    const again = await storeAutoTranslations(t.db, s.shop.id, "es", "run-2", [{ key, text: "Otra versión", sourceHash: hash }]);
    expect(again).toEqual({ stored: [], skippedEdited: [key] });
    expect((await translationsOf(t.db, s.shop.id))[0]).toMatchObject({ text: "Peluquería del barrio", status: "edited", runId: "run-1" });
    const redo = await storeAutoTranslations(t.db, s.shop.id, "es", "run-3", [{ key, text: "Peluquería de barrio, de nuevo", sourceHash: hash }], new Set([key]));
    expect(redo.stored).toEqual([key]);
    expect((await translationsOf(t.db, s.shop.id))[0]).toMatchObject({ status: "auto", runId: "run-3" });
  });

  it("a service of another shop is the answer of an unknown one, for a run and for an edit", async () => {
    const a = await withTexts();
    const b = await salon(t.db);
    const foreign = fieldKey({ kind: "service", refId: b.services.cut.id, field: "name" });
    await expect(storeAutoTranslations(t.db, a.shop.id, "es", "run", [{ key: foreign, text: "Corte", sourceHash: "x" }])).rejects.toMatchObject({ code: "AK_TRANSLATION_UNKNOWN" });
    await expect(saveEditedTranslation(t.db, a.shop.id, "es", foreign, "Corte", "x")).rejects.toMatchObject({ code: "AK_TRANSLATION_UNKNOWN" });
    await expect(saveEditedTranslation(t.db, a.shop.id, "es", fieldKey({ kind: "shop", refId: b.shop.id, field: "bio" }), "x", "x")).rejects.toMatchObject({ code: "AK_TRANSLATION_UNKNOWN" });
    expect(await translationsOf(t.db, b.shop.id)).toEqual([]);
  });

  it("a language can be removed, and a new source text is a new hash (the old translation is stale)", async () => {
    const s = await withTexts();
    const key = fieldKey({ kind: "shop", refId: s.shop.id, field: "tagline" });
    await storeAutoTranslations(t.db, s.shop.id, "es", "run-1", [{ key, text: "Peluquería de barrio", sourceHash: sourceHash("Coiffure de quartier") }]);
    await t.db.update(shops).set({ taglineFr: "Coiffure de quartier, sur rendez-vous" }).where(eq(shops.id, s.shop.id));
    const field = (await translatableFields(t.db, s.shop.id, "fr")).find((f) => f.key === key)!;
    expect((await translationsOf(t.db, s.shop.id))[0]!.sourceHash).not.toBe(field.sourceHash);
    await removeTranslationsOfLocale(t.db, s.shop.id, "es");
    expect(await translationsOf(t.db, s.shop.id)).toEqual([]);
  });
});

describe("the daily limit of translation runs", () => {
  it("is atomic and per shop", async () => {
    const a = await salon(t.db);
    const b = await salon(t.db);
    expect([await reserveTranslationRun(t.db, a.shop.id, "2026-10-23", 2), await reserveTranslationRun(t.db, a.shop.id, "2026-10-23", 2), await reserveTranslationRun(t.db, a.shop.id, "2026-10-23", 2)]).toEqual([true, true, false]);
    expect(await reserveTranslationRun(t.db, b.shop.id, "2026-10-23", 2)).toBe(true);
    expect(await reserveTranslationRun(t.db, a.shop.id, "2026-10-24", 2)).toBe(true);
    expect(await reserveTranslationRun(t.db, b.shop.id, "2026-10-25", 0)).toBe(false);
  });
});

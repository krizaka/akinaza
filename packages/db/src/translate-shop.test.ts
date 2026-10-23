import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { shops } from "./schema";
import { fieldKey, saveEditedTranslation, saveShopLanguages, sourceHash, translationRunsOn, translationsOf } from "./shop-translations";
import { translateShop, translationRows } from "./translate-shop";
import { freshDatabase } from "./test/db";
import { salon } from "./test/fixtures";
import { type TranslationPort, TranslationUnavailable } from "./translation-port";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

/** The port, mocked: it "translates" by tagging the language, and remembers what it was asked. */
const fakePort = () => {
  const calls: Parameters<TranslationPort["translate"]>[0][] = [];
  const port: TranslationPort = {
    async translate(request) {
      calls.push(request);
      return { runId: `run-${calls.length}`, texts: request.texts.map((x) => ({ key: x.key, text: `[${request.to}] ${x.text}` })) };
    },
  };
  return { port, calls };
};

const setup = async () => {
  const s = await salon(t.db);
  await t.db.update(shops).set({ taglineFr: "Coiffure de quartier", bioFr: "Julie et Marc vous reçoivent." }).where(eq(shops.id, s.shop.id));
  await saveShopLanguages(t.db, s.shop.id, { source: "fr", enabled: ["en", "es"] }, ["fr", "en", "es"]);
  return s;
};
const run = (shopId: string, locale: "en" | "es", extra: Partial<Parameters<typeof translateShop>[2]> = {}) => ({ shopId, locale, day: "2026-10-23", dailyLimit: 5, ...extra });

describe("« Traduire » through the port", () => {
  it("sends only the page's texts and the glossary, stores the answers with the run, once per language", async () => {
    const s = await setup();
    const { port, calls } = fakePort();
    const out = await translateShop(t.db, port, run(s.shop.id, "es"));
    expect(out.runId).toBe("run-1");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.from).toBe("fr");
    expect(calls[0]!.glossary).toEqual(expect.arrayContaining(["Salon Laurier", "Coupe", "Haircut", "1234 av. Laurier E., Montréal QC"]));
    expect(calls[0]!.texts.map((x) => x.key.split(":")[2]).sort()).toEqual(["bio", "name", "name", "tagline"]);
    expect(JSON.stringify(calls[0])).not.toMatch(/Camille|camille@|514-555/); // nothing about a client leaves
    const stored = (await translationsOf(t.db, s.shop.id)).filter((x) => x.locale === "es");
    expect(stored).toHaveLength(4);
    expect(stored.every((x) => x.status === "auto" && x.runId === "run-1")).toBe(true);
    const again = await translateShop(t.db, port, run(s.shop.id, "es"));
    expect(again.nothingToDo).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it("never sends or overwrites what the owner wrote in that language by hand", async () => {
    const s = await setup();
    await t.db.update(shops).set({ taglineEn: "Neighbourhood hair" }).where(eq(shops.id, s.shop.id));
    const { port, calls } = fakePort();
    await translateShop(t.db, port, run(s.shop.id, "en"));
    expect(calls[0]!.texts.some((x) => x.key.endsWith(":tagline"))).toBe(false);
    expect((await translationsOf(t.db, s.shop.id)).some((x) => x.key.endsWith(":tagline") && x.locale === "en")).toBe(false);
  });

  it("an edited text is never overwritten, even when its source changed (it is flagged), unless the owner redoes it", async () => {
    const s = await setup();
    const { port, calls } = fakePort();
    await translateShop(t.db, port, run(s.shop.id, "es"));
    const key = fieldKey({ kind: "shop", refId: s.shop.id, field: "tagline" });
    await saveEditedTranslation(t.db, s.shop.id, "es", key, "Peluquería del barrio", sourceHash("Coiffure de quartier"));
    await t.db.update(shops).set({ taglineFr: "Coiffure de quartier, depuis 2012" }).where(eq(shops.id, s.shop.id));
    const rows = await translationRows(t.db, s.shop.id);
    expect(rows.fields.find((f) => f.key === key)!.languages.es).toEqual({ state: "stale", text: "Peluquería del barrio" });
    const before = calls.length;
    await translateShop(t.db, port, run(s.shop.id, "es"));
    expect(calls.length).toBe(before); // nothing auto is stale, the edited one waits for the owner
    expect((await translationsOf(t.db, s.shop.id)).find((x) => x.key === key && x.locale === "es")).toMatchObject({ text: "Peluquería del barrio", status: "edited" });
    await translateShop(t.db, port, run(s.shop.id, "es", { redo: [key] }));
    expect((await translationsOf(t.db, s.shop.id)).find((x) => x.key === key && x.locale === "es")).toMatchObject({ text: "[es] Coiffure de quartier, depuis 2012", status: "auto" });
  });

  it("a changed source makes the automatic translation stale, and the next run redoes only that one", async () => {
    const s = await setup();
    const { port, calls } = fakePort();
    await translateShop(t.db, port, run(s.shop.id, "es"));
    await t.db.update(shops).set({ bioFr: "Julie et Marc, depuis 2012." }).where(eq(shops.id, s.shop.id));
    const bio = fieldKey({ kind: "shop", refId: s.shop.id, field: "bio" });
    expect((await translationRows(t.db, s.shop.id)).fields.find((f) => f.key === bio)!.languages.es!.state).toBe("stale");
    await translateShop(t.db, port, run(s.shop.id, "es"));
    expect(calls.at(-1)!.texts.map((x) => x.key)).toEqual([bio]);
  });

  it("refuses a language that is off, the source language, and a run past the daily limit; a port that fails stores nothing", async () => {
    const s = await setup();
    const { port } = fakePort();
    await expect(translateShop(t.db, port, run(s.shop.id, "en", { shopId: s.shop.id }))).resolves.toBeDefined();
    await saveShopLanguages(t.db, s.shop.id, { source: "fr", enabled: ["en"] }, ["fr", "en", "es"]);
    await expect(translateShop(t.db, port, run(s.shop.id, "es"))).rejects.toMatchObject({ code: "AK_LANGUAGE_NOT_ENABLED" });
    await expect(translateShop(t.db, port, { ...run(s.shop.id, "en"), locale: "fr" as never })).rejects.toMatchObject({ code: "AK_LANGUAGE_NOT_ENABLED" });
    const fresh = await setup();
    await expect(translateShop(t.db, port, run(fresh.shop.id, "es", { dailyLimit: 0 }))).rejects.toMatchObject({ code: "AK_TRANSLATION_LIMIT" });
    const down: TranslationPort = { translate: vi.fn(async () => { throw new TranslationUnavailable("not-wired"); }) };
    await expect(translateShop(t.db, down, run(fresh.shop.id, "es"))).rejects.toBeInstanceOf(TranslationUnavailable);
    expect(await translationsOf(t.db, fresh.shop.id)).toEqual([]);
    expect(await translationRunsOn(t.db, fresh.shop.id, "2026-10-23")).toBe(0); // the failed run is given back
  });
});

import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { documentFromLegacy, LEGACY_SECTION_IDS, shopTypeOf } from "@akinaza/core";
import { parseShopPage } from "@krizaka/ui/shop";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { migrate } from "./migrate";
import { SHOP_PAGE_DOCUMENT_MIGRATION_SQL } from "./shop-page-document-migration";
import { draftShopPage, publishedShopPage, publishShopPageDraft, readShopPage, rollbackShopPage, SHOP_PAGE_ARCHIVE_KEEP, saveShopPageDraft, ShopPageInvalidError, shopPageVersionsOf } from "./shop-page-versions";
import { freshDatabase, freshEmptyDatabase } from "./test/db";
import { walkerShop } from "./test/fixtures";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

const full = (hide: string[] = []) => LEGACY_SECTION_IDS.map((id) => ({ id, visible: !hide.includes(id) }));

describe("the shop page document", () => {
  it("reads a shop that never saved a page as its trade's starter, and writes nothing", async () => {
    const shop = await walkerShop(t.db, "doc-starter");
    const { page, version } = await publishedShopPage(t.db, shop.shopId);
    expect(version).toBeNull();
    expect(page.preset.id).toMatch(/^pets-/);
    expect(await shopPageVersionsOf(t.db, shop.shopId)).toEqual([]);
  });

  it("keeps one draft per shop, publishes it, archives the previous page and rolls back as a new version", async () => {
    const shop = await walkerShop(t.db, "doc-flow");
    const a = documentFromLegacy({ sections: full(), trade: "pets" });
    const b = documentFromLegacy({ sections: full(["wall"]), trade: "pets" });
    await saveShopPageDraft(t.db, shop.shopId, a, shop.owner.id);
    await saveShopPageDraft(t.db, shop.shopId, a, shop.owner.id);
    expect((await shopPageVersionsOf(t.db, shop.shopId)).map((v) => v.status)).toEqual(["draft"]);
    expect(await publishShopPageDraft(t.db, shop.shopId, shop.owner.id)).toEqual({ version: 2 });
    await saveShopPageDraft(t.db, shop.shopId, b, shop.owner.id);
    expect((await draftShopPage(t.db, shop.shopId)).draft).toBe(true);
    expect((await publishedShopPage(t.db, shop.shopId)).version).toBe(2);
    expect(await publishShopPageDraft(t.db, shop.shopId, shop.owner.id)).toEqual({ version: 4 });
    expect((await shopPageVersionsOf(t.db, shop.shopId)).map((v) => [v.version, v.status])).toEqual([[4, "published"], [2, "archived"]]);
    expect(await rollbackShopPage(t.db, shop.shopId, 2, shop.owner.id)).toEqual({ version: 5 });
    expect((await publishedShopPage(t.db, shop.shopId)).page.sections.some((s) => s.disabled)).toBe(false);
    await expect(publishShopPageDraft(t.db, shop.shopId, null)).rejects.toMatchObject({ code: "AK_SHOP_PAGE_NO_DRAFT" });
  });

  it("refuses an invalid document with the path of each issue, and writes nothing", async () => {
    const shop = await walkerShop(t.db, "doc-invalid");
    const bad = { ...documentFromLegacy({ sections: full(), trade: "pets" }), sections: [{ key: "s_x", type: "services", variant: "nope", settings: {} }] };
    const err = await saveShopPageDraft(t.db, shop.shopId, bad, null).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ShopPageInvalidError);
    expect((err as ShopPageInvalidError).issues[0]?.path).toMatch(/^sections\.0/);
    expect(await shopPageVersionsOf(t.db, shop.shopId)).toEqual([]);
    expect(() => readShopPage({ schema: 99 })).toThrow(ShopPageInvalidError);
  });

  it("bounds the document at 16 sections", async () => {
    const shop = await walkerShop(t.db, "doc-bounds");
    const doc = documentFromLegacy({ sections: full(), trade: "pets" });
    const over = { ...doc, sections: [...doc.sections, ...doc.sections.slice(1, 3).map((s, i) => ({ ...s, key: `s_extra_${i}` }))] };
    await expect(saveShopPageDraft(t.db, shop.shopId, over, null)).rejects.toBeInstanceOf(ShopPageInvalidError);
  });

  it("keeps the last archived versions only", async () => {
    const shop = await walkerShop(t.db, "doc-archive");
    const doc = documentFromLegacy({ sections: full(), trade: "pets" });
    for (let i = 0; i < SHOP_PAGE_ARCHIVE_KEEP + 3; i++) {
      await saveShopPageDraft(t.db, shop.shopId, doc, null);
      await publishShopPageDraft(t.db, shop.shopId, null);
    }
    const versions = await shopPageVersionsOf(t.db, shop.shopId);
    expect(versions.filter((v) => v.status === "archived")).toHaveLength(SHOP_PAGE_ARCHIVE_KEEP);
    expect(versions.filter((v) => v.status === "published")).toHaveLength(1);
  });

  it("never reaches another shop's versions (not found)", async () => {
    const mine = await walkerShop(t.db, "doc-own");
    const other = await walkerShop(t.db, "doc-other");
    const doc = documentFromLegacy({ sections: full(), trade: "pets" });
    await saveShopPageDraft(t.db, other.shopId, doc, null);
    await publishShopPageDraft(t.db, other.shopId, null);
    await saveShopPageDraft(t.db, other.shopId, doc, null);
    await publishShopPageDraft(t.db, other.shopId, null);
    await expect(rollbackShopPage(t.db, mine.shopId, 1, null)).rejects.toMatchObject({ code: "AK_NOT_FOUND" });
    expect(await shopPageVersionsOf(t.db, mine.shopId)).toEqual([]);
  });
});

describe("migration 0038: today's pages become documents", () => {
  it("turns every existing shop page into a published v1 with today's content: order, visibility, trade", async () => {
    const dir = fileURLToPath(new URL("../drizzle", import.meta.url));
    const before = mkdtempSync(join(tmpdir(), "ak-mig-"));
    const old = await freshEmptyDatabase();
    try {
      cpSync(dir, before, { recursive: true });
      const journal = JSON.parse(readFileSync(join(before, "meta/_journal.json"), "utf8")) as { entries: { tag: string }[] };
      journal.entries = journal.entries.filter((e) => Number(e.tag.slice(0, 4)) < 38);
      writeFileSync(join(before, "meta/_journal.json"), JSON.stringify(journal));
      await migrate(old.pool, before);
      const owner = (await old.pool.query(`INSERT INTO accounts (email, locale, password_hash) VALUES ('mig@example.test', 'fr', 'x') RETURNING id`)).rows[0].id as string;
      const shop = async (business: "professional" | "pets", sections: unknown, shopType: string | null) => {
        const id = (await old.pool.query(`INSERT INTO shops (owner_id, name, legal_name, kind, address, registrant, business_type) VALUES ($1, 'S', 'S inc.', 'services', '1 rue Test', false, $2) RETURNING id`, [owner, business])).rows[0].id as string;
        await old.pool.query(`INSERT INTO shop_page (shop_id, sections, shop_type) VALUES ($1, $2::jsonb, $3)`, [id, JSON.stringify(sections), shopType]);
        return id;
      };
      const reordered = [...full(["wall", "follow"])].reverse();
      const cases = [
        { id: await shop("professional", full(), null), sections: full(), trade: shopTypeOf("professional") },
        { id: await shop("pets", reordered, null), sections: reordered, trade: shopTypeOf("pets") },
        { id: await shop("professional", full(["reviews", "zones"]), "salon"), sections: full(["reviews", "zones"]), trade: "salon" as const },
        { id: await shop("professional", full().filter((s) => s.id !== "trust"), "coaching"), sections: full().filter((s) => s.id !== "trust"), trade: "coaching" as const },
      ];
      await migrate(old.pool, dir);
      for (const c of cases) {
        const rows = (await old.pool.query(`SELECT version, status, schema, doc FROM shop_page_versions WHERE shop_id = $1`, [c.id])).rows;
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ version: 1, status: "published", schema: 1 });
        expect(parseShopPage(rows[0].doc).ok).toBe(true);
        // The SQL and the pure function agree on every page, so today's content survives exactly.
        expect(rows[0].doc).toEqual(JSON.parse(JSON.stringify(documentFromLegacy({ sections: c.sections, trade: c.trade }))));
      }
      // Visible sections stay enabled, the hidden ones are disabled, the order is the owner's.
      const hidden = (await old.pool.query(`SELECT doc FROM shop_page_versions WHERE shop_id = $1`, [cases[2]!.id])).rows[0].doc.sections as { key: string; disabled?: boolean }[];
      expect(hidden.filter((s) => s.disabled).map((s) => s.key)).toEqual(["s_zones", "s_reviews"]);
    } finally {
      await old.drop();
      rmSync(before, { recursive: true, force: true });
    }
  });
});

it("0038_shop_page_document.sql is the generator's output (never edited by hand)", () => {
  const file = readFileSync(fileURLToPath(new URL("../drizzle/0038_shop_page_document.sql", import.meta.url)), "utf8");
  expect(file).toBe(SHOP_PAGE_DOCUMENT_MIGRATION_SQL);
});

describe("the page is parsed at read time (akinaza#401)", () => {
  it("refuses to draw a stored document that no longer parses, naming the path, instead of drawing half a page", async () => {
    const shop = await walkerShop(t.db, "doc-read");
    const doc = documentFromLegacy({ sections: full(), trade: "pets" });
    await t.pool.query(`INSERT INTO shop_page_versions (shop_id, version, status, schema, doc, published_at) VALUES ($1, 1, 'published', 1, $2::jsonb, now())`, [shop.shopId, JSON.stringify({ ...doc, sections: [{ ...doc.sections[0], variant: "nope" }] })]);
    await expect(publishedShopPage(t.db, shop.shopId)).rejects.toBeInstanceOf(ShopPageInvalidError);
  });

  it("brings a document through migrateShopPage before parsing it", async () => {
    const doc = documentFromLegacy({ sections: full(), trade: "pets" });
    expect(readShopPage(JSON.parse(JSON.stringify(doc))).schema).toBe(1);
  });
});

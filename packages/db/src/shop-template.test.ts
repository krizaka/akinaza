import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { TEMPLATES } from "@akinaza/core";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { migrate } from "./migrate";
import { shopPage, shops } from "./schema";
import { applyTemplate, DEFAULT_SHOP_PAGE_SECTIONS, saveShopPageConfig, SHOP_PAGE_SECTIONS, sectionsFromTemplate, shopPageConfigOf, withTrust } from "./shop-page";
import { freshDatabase, freshEmptyDatabase } from "./test/db";
import { walkerShop } from "./test/fixtures";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

const SALON = TEMPLATES.find((x) => x.id === "salon-carte")!;

describe("the migration of pages saved before templates (#261)", () => {
  it("marks a page the owner customised, leaves a default page alone, and starts everyone with no template", async () => {
    const full = fileURLToPath(new URL("../drizzle", import.meta.url));
    const before = mkdtempSync(join(tmpdir(), "ak-mig-tpl-"));
    try {
      cpSync(full, before, { recursive: true });
      const journal = JSON.parse(readFileSync(join(before, "meta/_journal.json"), "utf8")) as { entries: { tag: string }[] };
      journal.entries = journal.entries.filter((e) => Number(e.tag.slice(0, 4)) < 31);
      writeFileSync(join(before, "meta/_journal.json"), JSON.stringify(journal));
      const old = await freshEmptyDatabase();
      try {
        await migrate(old.pool, before);
        const shop = async (n: number) => {
          const owner = (await old.pool.query("INSERT INTO accounts (email, password_hash) VALUES ($1, 'x') RETURNING id", [`o${n}@example.test`])).rows[0].id as string;
          return (await old.pool.query("INSERT INTO shops (owner_id, name, legal_name, kind, address, registrant) VALUES ($1, 'S', 'S inc.', 'services', '1 rue Test', false) RETURNING id", [owner])).rows[0].id as string;
        };
        const [plain, reordered, hidden] = [await shop(1), await shop(2), await shop(3)];
        await old.pool.query("INSERT INTO shop_page (shop_id) VALUES ($1)", [plain]); // the default sections
        const sections = DEFAULT_SHOP_PAGE_SECTIONS.map((s) => ({ ...s }));
        await old.pool.query("INSERT INTO shop_page (shop_id, sections) VALUES ($1, $2)", [reordered, JSON.stringify([...sections].reverse())]);
        await old.pool.query("INSERT INTO shop_page (shop_id, sections) VALUES ($1, $2)", [hidden, JSON.stringify(sections.map((s) => (s.id === "gallery" ? { ...s, visible: false } : s)))]);
        await migrate(old.pool, full);
        const rows = (await old.pool.query("SELECT shop_id, sections_custom, template_id, template_version, style FROM shop_page")).rows as { shop_id: string; sections_custom: boolean; template_id: string | null; template_version: number | null; style: unknown }[];
        const by = (id: string) => rows.find((r) => r.shop_id === id)!;
        expect(by(plain).sections_custom).toBe(false);
        expect(by(reordered).sections_custom).toBe(true);
        expect(by(hidden).sections_custom).toBe(true);
        for (const r of rows) expect([r.template_id, r.template_version, r.style]).toEqual([null, null, {}]);
      } finally {
        await old.drop();
      }
    } finally {
      rmSync(before, { recursive: true, force: true });
    }
  });
});

describe("saving the sections by hand", () => {
  it("marks the page customised only when the owner changes the order or the visibility", async () => {
    const shop = await walkerShop(t.db, "tpl-save");
    const config = await shopPageConfigOf(t.db, shop.shopId);
    expect(config).toMatchObject({ templateId: null, templateVersion: null, sectionsCustom: false });
    await saveShopPageConfig(t.db, shop.shopId, { ...config, logoUrl: "https://cdn.example/l.webp" });
    expect((await shopPageConfigOf(t.db, shop.shopId)).sectionsCustom).toBe(false); // a logo is not a reorder
    await saveShopPageConfig(t.db, shop.shopId, { ...config, sections: [...config.sections].reverse() });
    expect((await shopPageConfigOf(t.db, shop.shopId)).sectionsCustom).toBe(true);
    await saveShopPageConfig(t.db, shop.shopId, config); // back to the default order: it stays marked (the owner did customise)
    expect((await shopPageConfigOf(t.db, shop.shopId)).sectionsCustom).toBe(true);
  });

  it("the save never touches the template, whatever the body says", async () => {
    const shop = await walkerShop(t.db, "tpl-ignore");
    await applyTemplate(t.db, shop.shopId, { templateId: "salon-carte" });
    const config = await shopPageConfigOf(t.db, shop.shopId);
    await saveShopPageConfig(t.db, shop.shopId, { ...config, templateId: "pets-vitrine", templateVersion: 1 });
    expect(await shopPageConfigOf(t.db, shop.shopId)).toMatchObject({ templateId: "salon-carte", templateVersion: 1 });
  });
});

describe("applying a template", () => {
  it("on a default page: the template's order for what it lists, the other sections as they were, no customisation, the id and version kept", async () => {
    const shop = await walkerShop(t.db, "tpl-first");
    const applied = await applyTemplate(t.db, shop.shopId, { templateId: "salon-carte" });
    expect(applied).toMatchObject({ id: "salon-carte", version: 1 });
    const config = await shopPageConfigOf(t.db, shop.shopId);
    expect(config).toMatchObject({ templateId: "salon-carte", templateVersion: 1, sectionsCustom: false });
    const listed = SALON.sections.map((s) => s.id).filter((id) => (SHOP_PAGE_SECTIONS as readonly string[]).includes(id));
    expect(config.sections.slice(0, listed.length).map((s) => s.id)).toEqual(listed);
    expect(config.sections.map((s) => s.id).sort()).toEqual([...SHOP_PAGE_SECTIONS].sort()); // nothing lost, nothing twice
  });

  it("on a customised page it asks first; « keep my order » keeps it, « use the template's » replaces it and clears the mark", async () => {
    const shop = await walkerShop(t.db, "tpl-custom");
    const config = await shopPageConfigOf(t.db, shop.shopId);
    const mine = [...config.sections].reverse();
    await saveShopPageConfig(t.db, shop.shopId, { ...config, sections: mine });
    await expect(applyTemplate(t.db, shop.shopId, { templateId: "salon-carte" })).rejects.toMatchObject({ code: "AK_SECTIONS_CUSTOM" });
    expect((await shopPageConfigOf(t.db, shop.shopId)).templateId).toBeNull();
    await applyTemplate(t.db, shop.shopId, { templateId: "salon-carte", keepOrder: true });
    expect(await shopPageConfigOf(t.db, shop.shopId)).toMatchObject({ templateId: "salon-carte", sectionsCustom: true, sections: mine });
    await applyTemplate(t.db, shop.shopId, { templateId: "salon-vitrine", keepOrder: false });
    const replaced = await shopPageConfigOf(t.db, shop.shopId);
    expect(replaced).toMatchObject({ templateId: "salon-vitrine", sectionsCustom: false });
    expect(replaced.sections[0]!.id).toBe("services");
  });

  it("never touches the shop's content: texts, media and what the owner wrote stay as they are", async () => {
    const shop = await walkerShop(t.db, "tpl-content");
    await t.db.update(shops).set({ taglineFr: "Des promenades de quartier", bioEn: "I walk dogs." }).where(eq(shops.id, shop.shopId));
    const before = (await t.db.select().from(shops).where(eq(shops.id, shop.shopId)))[0]!;
    await applyTemplate(t.db, shop.shopId, { templateId: "pets-histoire" });
    await applyTemplate(t.db, shop.shopId, { templateId: "pets-vitrine" });
    const after = (await t.db.select().from(shops).where(eq(shops.id, shop.shopId)))[0]!;
    expect(after).toEqual(before);
  });

  it("keeps the applied version when the template improves; without a version it applies the latest", async () => {
    const shop = await walkerShop(t.db, "tpl-version");
    const v2 = { ...SALON, version: 2, sections: [...SALON.sections].reverse() };
    await applyTemplate(t.db, shop.shopId, { templateId: "salon-carte", templateVersion: 1 }, [SALON, v2]);
    expect((await shopPageConfigOf(t.db, shop.shopId)).templateVersion).toBe(1);
    await applyTemplate(t.db, shop.shopId, { templateId: "salon-carte", keepOrder: false }, [SALON, v2]);
    expect((await shopPageConfigOf(t.db, shop.shopId)).templateVersion).toBe(2);
  });

  it("an unknown id or version, or one the administrator does not offer, is the same refusal and changes nothing", async () => {
    const shop = await walkerShop(t.db, "tpl-unknown");
    for (const input of [{ templateId: "nope-nope" }, { templateId: "salon-carte", templateVersion: 9 }, { templateId: "salon-carte", offered: ["salon-vitrine"] }, { templateId: "salon-carte", offered: [] }]) {
      await expect(applyTemplate(t.db, shop.shopId, input)).rejects.toMatchObject({ code: "AK_TEMPLATE_UNKNOWN" });
    }
    expect((await shopPageConfigOf(t.db, shop.shopId)).templateId).toBeNull();
  });

  it("maps a template onto the sections, `trust` included, keeping the rest as they are", () => {
    const current = DEFAULT_SHOP_PAGE_SECTIONS.map((s) => (s.id === "wall" ? { ...s, visible: false } : { ...s }));
    const out = sectionsFromTemplate(SALON, current);
    expect(out.map((s) => s.id)).toEqual(["services", "hours", "team", "trust", "gallery", "zones", "wall", "reels", "announcements", "reviews", "follow"]);
    expect(out.find((s) => s.id === "wall")!.visible).toBe(false);
  });

  it("the database refuses a template id without its version, and a malformed id", async () => {
    const shop = await walkerShop(t.db, "tpl-check");
    await expect(t.pool.query("INSERT INTO shop_page (shop_id, template_id) VALUES ($1, 'salon-carte')", [shop.shopId])).rejects.toThrow();
    await expect(t.pool.query("INSERT INTO shop_page (shop_id, template_id, template_version) VALUES ($1, 'Salon Carte', 1)", [shop.shopId])).rejects.toThrow();
    expect((await t.db.select().from(shopPage).where(eq(shopPage.shopId, shop.shopId))).length).toBe(0);
  });
});

describe("`trust` is an orderable section (#261, step 3)", () => {
  const LEGACY = ["services", "team", "hours", "zones", "gallery", "wall", "reels", "announcements", "reviews", "follow"].map((id) => ({ id, visible: true }));

  it("a page saved before it, with ten sections, is read with `trust` just before `gallery`: today's placement, nothing changes", async () => {
    const shop = await walkerShop(t.db, "tpl-legacy");
    await t.pool.query("INSERT INTO shop_page (shop_id, sections) VALUES ($1, $2)", [shop.shopId, JSON.stringify(LEGACY)]);
    const config = await shopPageConfigOf(t.db, shop.shopId);
    expect(config.sections.map((s) => s.id)).toEqual(["services", "team", "hours", "zones", "trust", "gallery", "wall", "reels", "announcements", "reviews", "follow"]);
    expect(config.sections.find((s) => s.id === "trust")!.visible).toBe(true);
    expect(config.sectionsCustom).toBe(false); // an untouched legacy page is not « customised » by the new id
    expect(DEFAULT_SHOP_PAGE_SECTIONS.map((s) => s.id)).toEqual(config.sections.map((s) => s.id));
  });

  it("an owner's hidden gallery or reorder on a legacy page is kept, with `trust` where it always was", async () => {
    const shop = await walkerShop(t.db, "tpl-legacy-custom");
    const mine = [{ id: "gallery", visible: false }, ...LEGACY.filter((s) => s.id !== "gallery")];
    await t.pool.query("INSERT INTO shop_page (shop_id, sections, sections_custom) VALUES ($1, $2, true)", [shop.shopId, JSON.stringify(mine)]);
    // `trust` was always drawn right before the gallery, wherever the owner put it: it keeps doing so.
    expect((await shopPageConfigOf(t.db, shop.shopId)).sections.map((s) => s.id).slice(0, 3)).toEqual(["trust", "gallery", "services"]);
    expect(withTrust(mine)[1]).toMatchObject({ id: "gallery", visible: false });
  });

  it("an old browser tab that still posts ten sections is accepted, and `trust` stays where it was", async () => {
    const shop = await walkerShop(t.db, "tpl-oldtab");
    const config = await shopPageConfigOf(t.db, shop.shopId);
    await saveShopPageConfig(t.db, shop.shopId, { ...config, sections: LEGACY });
    expect((await shopPageConfigOf(t.db, shop.shopId)).sections.map((s) => s.id)).toContain("trust");
    expect((await shopPageConfigOf(t.db, shop.shopId)).sectionsCustom).toBe(false);
  });

  it("a template's story-first layout can now put `trust` first, and applying it to a legacy page works", async () => {
    const shop = await walkerShop(t.db, "tpl-story");
    await t.pool.query("INSERT INTO shop_page (shop_id, sections) VALUES ($1, $2)", [shop.shopId, JSON.stringify(LEGACY)]);
    await applyTemplate(t.db, shop.shopId, { templateId: "pets-histoire" });
    expect((await shopPageConfigOf(t.db, shop.shopId)).sections[0]!.id).toBe("trust");
  });

  it("every section id of every template is a configurable section", () => {
    for (const template of TEMPLATES) for (const section of template.sections) expect(SHOP_PAGE_SECTIONS as readonly string[], `${template.id}/${section.id}`).toContain(section.id);
  });
});


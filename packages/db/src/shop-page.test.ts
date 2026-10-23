import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { defaultShopPageConfig, saveShopPageConfig, shopPageConfigOf } from "./shop-page";
import { publicShop } from "./service-shop";
import { freshDatabase } from "./test/db";
import { walkerShop } from "./test/fixtures";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

describe("the owner's storefront configuration", () => {
  it("keeps today's page defaults when no configuration row exists", async () => {
    const shop = await walkerShop(t.db, "page-default");
    expect(await shopPageConfigOf(t.db, shop.shopId)).toEqual(defaultShopPageConfig());
  });

  it("persists section order, visibility, and logo on both owner and public reads", async () => {
    const shop = await walkerShop(t.db, "page-saved");
    const config = defaultShopPageConfig();
    config.sections.reverse();
    config.sections[0] = { id: "follow", visible: false };
    config.logoUrl = "https://cdn.example/brand/logo.webp";
    await saveShopPageConfig(t.db, shop.shopId, config);
    expect(await shopPageConfigOf(t.db, shop.shopId)).toEqual(config);
    expect((await publicShop(t.db, "pattes-page-saved"))?.pageConfig).toEqual(config);
  });

  it("rejects missing or duplicate sections and non-HTTPS logos", async () => {
    const shop = await walkerShop(t.db, "page-invalid");
    const config = defaultShopPageConfig();
    await expect(saveShopPageConfig(t.db, shop.shopId, { ...config, sections: config.sections.slice(1) })).rejects.toThrow();
    await expect(saveShopPageConfig(t.db, shop.shopId, { ...config, sections: [...config.sections.slice(0, -1), config.sections[0]!] })).rejects.toThrow();
    await expect(saveShopPageConfig(t.db, shop.shopId, { ...config, logoUrl: "http://cdn.example/logo.png" })).rejects.toThrow();
  });
});

describe("the street address is private (#265)", () => {
  it("never leaves the public read of a shop: neither the address nor the legal name", async () => {
    const s = await walkerShop(t.db, "addr");
    const page = await publicShop(t.db, "pattes-addr");
    expect(page).not.toBeNull();
    const json = JSON.stringify(page);
    expect(json).not.toContain("2000 rue Notre-Dame");
    expect(json).not.toContain("legalName");
    expect(Object.keys(page!.shop)).not.toContain("address");
    expect(s.shopId).toBe(page!.shop.id);
  });
});

describe("the shop type and the proposed images (#267)", () => {
  it("defaults to no chosen type and proposed images on, and a save that does not name them keeps them", async () => {
    const shop = await walkerShop(t.db, "page-type");
    expect(await shopPageConfigOf(t.db, shop.shopId)).toMatchObject({ shopType: null, useDefaults: true });
    const config = defaultShopPageConfig();
    await saveShopPageConfig(t.db, shop.shopId, { ...config, shopType: "salon", useDefaults: false });
    expect(await shopPageConfigOf(t.db, shop.shopId)).toMatchObject({ shopType: "salon", useDefaults: false });
    const { shopType: _type, useDefaults: _use, ...sectionsOnly } = config;
    await saveShopPageConfig(t.db, shop.shopId, sectionsOnly);
    expect(await shopPageConfigOf(t.db, shop.shopId)).toMatchObject({ shopType: "salon", useDefaults: false });
  });

  it("refuses a type that is not one of the trades, in the schema and in the database", async () => {
    const shop = await walkerShop(t.db, "page-type-bad");
    await expect(saveShopPageConfig(t.db, shop.shopId, { ...defaultShopPageConfig(), shopType: "restaurant" })).rejects.toThrow();
    await expect(t.pool.query("INSERT INTO shop_page (shop_id, shop_type) VALUES ($1, 'bar')", [shop.shopId])).rejects.toThrow();
  });

  it("a save that names only the trade or the switch leaves the sections and the logo as they were: the images card never overwrites the look card", async () => {
    const shop = await walkerShop(t.db, "page-type-partial");
    const config = defaultShopPageConfig();
    config.sections.reverse();
    config.logoUrl = "https://cdn.example/brand/logo.webp";
    await saveShopPageConfig(t.db, shop.shopId, config);
    await saveShopPageConfig(t.db, shop.shopId, { shopType: "coaching" });
    await saveShopPageConfig(t.db, shop.shopId, { useDefaults: false });
    // The reversed order is the owner's own (#261): flagged once, and a save that names no sections leaves the flag alone.
    expect(await shopPageConfigOf(t.db, shop.shopId)).toEqual({ ...config, shopType: "coaching", useDefaults: false, sectionsCustom: true });
  });

  it("a first save that names only the trade starts from today's page", async () => {
    const shop = await walkerShop(t.db, "page-type-first");
    await saveShopPageConfig(t.db, shop.shopId, { shopType: "cleaning" });
    expect(await shopPageConfigOf(t.db, shop.shopId)).toEqual({ ...defaultShopPageConfig(), shopType: "cleaning" });
  });
});

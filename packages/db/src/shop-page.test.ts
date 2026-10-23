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

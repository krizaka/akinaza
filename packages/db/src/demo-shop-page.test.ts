import { demoLooksOf } from "@akinaza/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DEMO_PAGES, seedDemoPages } from "./demo-shop-page";
import { seedDemoShops } from "./demo-shops";
import { publicShop } from "./service-shop";
import { publishedShopPage, shopPageVersionsOf } from "./shop-page-versions";
import { freshDatabase } from "./test/db";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

describe("the demo shops' page (akinaza#403, #404)", () => {
  it("holds the 18 generated photos: a cover and a gallery per shop, every one with its alt text in both languages, no two the same", () => {
    const all = DEMO_PAGES.flatMap((d) => [d.cover, ...d.gallery]);
    expect(all).toHaveLength(18);
    expect(new Set(all.map((s) => s.url)).size).toBe(all.length);
    for (const s of all) {
      expect(s.url).toMatch(/^https:\/\/krizaka-assets\.b-cdn\.net\/site\/products\/akinaza\/demo\/[a-z-]+\.[0-9a-f]{10}\.webp$/);
      expect(s.altFr?.length).toBeGreaterThan(5);
      expect(s.altEn?.length).toBeGreaterThan(5);
    }
  });

  it("starts the salon compact and the dog walker on the route: the first look of the switch is the page's own", () => {
    for (const demo of DEMO_PAGES) expect(demoLooksOf(demo.slug)[0]!.starter).toBe(demo.starter);
  });

  it("puts the photos on the shop and publishes its document once; a second run changes nothing", async () => {
    await seedDemoShops(t.db);
    const first = await seedDemoPages(t.db);
    expect(first.map((p) => p.slug)).toEqual(["cedre-ciseaux"]);
    expect(first[0]).toMatchObject({ photos: 10, published: true });
    const shop = (await publicShop(t.db, "cedre-ciseaux"))!;
    expect(shop.media.cover?.url).toContain("salon-cover");
    expect(shop.media.gallery).toHaveLength(9);
    expect((await publishedShopPage(t.db, shop.shop.id)).page.preset.id).toBe("salon-vitrine");
    const second = await seedDemoPages(t.db);
    expect(second[0]!.published).toBe(false);
    expect(await shopPageVersionsOf(t.db, shop.shop.id)).toHaveLength(1);
  });
});

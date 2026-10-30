import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { eq } from "drizzle-orm";

import { shops } from "./schema";
import { loadShop, publicShop, reorderServices, saveService } from "./service-shop";
import { saveShopPageConfig, shopPageConfigOf } from "./shop-page";
import { freshDatabase } from "./test/db";
import { walkerShop } from "./test/fixtures";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

const offer = (nameEn: string, over: Record<string, unknown> = {}) => ({ nameFr: nameEn, nameEn, durationMinutes: 30, priceCents: 0, capacity: 1, priceVaries: true, ...over });

async function shopOf(shopId: string) {
  const [row] = await t.db.select().from(shops).where(eq(shops.id, shopId));
  return row!;
}

describe("the offers' order and link (#597)", () => {
  it("lists the offers in the owner's order: a new one comes last, a reorder is kept", async () => {
    const s = await walkerShop(t.db, "offers-order");
    const base = (await loadShop(t.db, await shopOf(s.shopId))).services.length;
    const ids: string[] = [];
    for (const name of ["Yomizaka", "Akinaza", "Orazaka", "Entreprise"]) ids.push(await saveService(t.db, s.shopId, offer(name)));
    const listed = async () => (await loadShop(t.db, await shopOf(s.shopId))).services.map((x) => x.nameEn).slice(base);
    expect(await listed()).toEqual(["Yomizaka", "Akinaza", "Orazaka", "Entreprise"]);
    const all = (await loadShop(t.db, await shopOf(s.shopId))).services.map((x) => x.id);
    const reordered = [...all.slice(0, base), ids[3]!, ids[0]!, ids[1]!, ids[2]!];
    expect(await reorderServices(t.db, s.shopId, reordered)).toBe(true);
    expect(await listed()).toEqual(["Entreprise", "Yomizaka", "Akinaza", "Orazaka"]);
  });

  it("refuses a reorder that omits, repeats or invents an offer", async () => {
    const s = await walkerShop(t.db, "offers-refuse");
    const a = await saveService(t.db, s.shopId, offer("A"));
    const all = (await loadShop(t.db, await shopOf(s.shopId))).services.map((x) => x.id);
    expect(await reorderServices(t.db, s.shopId, all.filter((id) => id !== a))).toBe(false);
    expect(await reorderServices(t.db, s.shopId, [...all, a])).toBe(false);
    expect(await reorderServices(t.db, s.shopId, [...all.slice(1), "00000000-0000-0000-0000-000000000000"])).toBe(false);
  });

  it("carries an https link to the public page, and clears it with null", async () => {
    const s = await walkerShop(t.db, "offers-link");
    const id = await saveService(t.db, s.shopId, offer("Yomizaka", { linkUrl: "https://dev.yomizaka.com" }));
    const row = await shopOf(s.shopId);
    const found = (await loadShop(t.db, row)).services.find((x) => x.id === id);
    expect(found?.linkUrl).toBe("https://dev.yomizaka.com");
    await saveService(t.db, s.shopId, offer("Yomizaka", { id, linkUrl: null }));
    expect((await loadShop(t.db, row)).services.find((x) => x.id === id)?.linkUrl).toBeNull();
    await saveService(t.db, s.shopId, offer("Yomizaka", { id, linkUrl: "https://dev.yomizaka.com" }));
    const pub = await publicShop(t.db, "pattes-offers-link");
    expect(pub?.services.find((x) => x.id === id)?.linkUrl).toBe("https://dev.yomizaka.com");
  });

  it("refuses a link that is not https", async () => {
    const s = await walkerShop(t.db, "offers-http");
    await expect(saveService(t.db, s.shopId, offer("X", { linkUrl: "http://dev.example.com" }))).rejects.toThrow();
    await expect(saveService(t.db, s.shopId, offer("X", { linkUrl: "javascript:alert(1)" }))).rejects.toThrow();
  });
});

describe("a logo for each theme (#597)", () => {
  it("keeps a dark-theme logo next to the light one, https only", async () => {
    const s = await walkerShop(t.db, "logo-dark");
    expect((await shopPageConfigOf(t.db, s.shopId)).logoDarkUrl).toBeNull();
    await saveShopPageConfig(t.db, s.shopId, { logoUrl: "https://cdn.example/logo-light.png", logoDarkUrl: "https://cdn.example/logo-dark.png" });
    expect(await shopPageConfigOf(t.db, s.shopId)).toMatchObject({ logoUrl: "https://cdn.example/logo-light.png", logoDarkUrl: "https://cdn.example/logo-dark.png" });
    await saveShopPageConfig(t.db, s.shopId, { logoDarkUrl: null });
    expect((await shopPageConfigOf(t.db, s.shopId)).logoDarkUrl).toBeNull();
    await expect(saveShopPageConfig(t.db, s.shopId, { logoDarkUrl: "http://cdn.example/x.png" })).rejects.toThrow();
  });
});

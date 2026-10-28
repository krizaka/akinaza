import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { exploreShops } from "./explore";
import { shopRules, shopZones, shops } from "./schema";
import { freshDatabase } from "./test/db";
import { NOW, walkerShop } from "./test/fixtures";

let t: Awaited<ReturnType<typeof freshDatabase>>;
let w: Awaited<ReturnType<typeof walkerShop>>;
beforeAll(async () => {
  t = await freshDatabase();
  w = await walkerShop(t.db, "x");
  await t.db.update(shopZones).set({ lat: 45.4797, lng: -73.5848 }).where(eq(shopZones.id, w.zones.stHenri));
});
afterAll(async () => t.drop());

describe("Explorer's shops (real PostgreSQL 16)", () => {
  it("lists the published shop with its quartiers and the position of the first area that has one", async () => {
    const list = await exploreShops(t.db, NOW);
    const shop = list.find((s) => s.slug === "pattes-x");
    expect(shop).toBeDefined();
    expect(shop!.quartiers).toEqual(expect.arrayContaining(["Saint-Henri", "Griffintown"]));
    expect(shop!.point).toEqual([-73.5848, 45.4797]);
  });

  it("says open now and a free time today from the hours, in the shop's zone (Monday 10:00 open, 08:00 not yet)", async () => {
    const early = (await exploreShops(t.db, NOW)).find((s) => s.slug === "pattes-x")!;
    expect(early.openNow).toBe(false);
    const open = (await exploreShops(t.db, new Date("2026-10-19T14:00:00Z"))).find((s) => s.slug === "pattes-x")!;
    expect(open.openNow).toBe(true);
    const saturday = (await exploreShops(t.db, new Date("2026-10-24T14:00:00Z"))).find((s) => s.slug === "pattes-x")!;
    expect(saturday.openNow).toBe(false);
    expect(saturday.freeToday).toBe(false);
  });

  it("never lists an unpublished shop, and carries no private field (no street address, owner, legal name or tax number)", async () => {
    await t.db.update(shops).set({ published: false }).where(eq(shops.id, w.shopId));
    expect((await exploreShops(t.db, NOW)).some((s) => s.slug === "pattes-x")).toBe(false);
    await t.db.update(shops).set({ published: true }).where(eq(shops.id, w.shopId));
    const json = JSON.stringify(await exploreShops(t.db, NOW));
    expect(json).not.toMatch(/Notre-Dame|legalName|ownerId|gstNumber|qstNumber|address/);
  });

  it("leaves out a published shop whose page cannot be read yet (no booking rules): one shop never fails the whole list (a 400 on /api/explore/shops)", async () => {
    await t.db.delete(shopRules).where(eq(shopRules.shopId, w.shopId));
    const shop = (await exploreShops(t.db, new Date("2026-10-19T14:00:00Z"))).find((s) => s.slug === "pattes-x");
    expect(shop).toBeUndefined();
  });
});

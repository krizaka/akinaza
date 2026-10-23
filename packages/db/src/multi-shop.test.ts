import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { shops } from "./schema";
import { saveShopPage, setDefaultShop, shopOfOwner, shopsOfOwner, ShopError } from "./service-shop";
import { freshDatabase } from "./test/db";
import { account } from "./test/fixtures";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

const page = (slug: string, name = slug) => ({ name, legalName: name, address: "1 rue Test", slug, ownerName: "Éric" });

describe("an owner with several shops", () => {
  it("the first shop is the default, an added one is not, and the default can move", async () => {
    const owner = await account(t.db, "two@example.test");
    const first = await saveShopPage(t.db, owner.id, page("premier"));
    const second = await saveShopPage(t.db, owner.id, page("second"), { additional: true, maxShops: 5 });
    expect(second.created).toBe(true);
    expect(second.shopId).not.toBe(first.shopId);
    expect((await shopsOfOwner(t.db, owner.id)).map((s) => [s.slug, s.isDefault])).toEqual([["premier", true], ["second", false]]);
    expect((await shopOfOwner(t.db, owner.id))?.id).toBe(first.shopId);
    expect((await shopOfOwner(t.db, owner.id, second.shopId))?.id).toBe(second.shopId);
    await setDefaultShop(t.db, owner.id, second.shopId);
    expect((await shopsOfOwner(t.db, owner.id)).map((s) => [s.slug, s.isDefault])).toEqual([["second", true], ["premier", false]]);
    expect((await shopOfOwner(t.db, owner.id))?.id).toBe(second.shopId);
  });

  it("saving without a shop updates the default; with shopId, that shop; never another owner's", async () => {
    const owner = await account(t.db, "save@example.test");
    const a = await saveShopPage(t.db, owner.id, page("save-a"));
    const b = await saveShopPage(t.db, owner.id, page("save-b"), { additional: true, maxShops: 5 });
    await saveShopPage(t.db, owner.id, page("save-a", "Renamed A"));
    await saveShopPage(t.db, owner.id, page("save-b", "Renamed B"), { shopId: b.shopId });
    expect((await shopsOfOwner(t.db, owner.id)).map((s) => s.name)).toEqual(["Renamed A", "Renamed B"]);
    const stranger = await account(t.db, "stranger@example.test");
    await expect(saveShopPage(t.db, stranger.id, page("save-x"), { shopId: a.shopId })).rejects.toMatchObject({ code: "AK_SHOP_UNKNOWN" });
    await expect(setDefaultShop(t.db, stranger.id, a.shopId)).rejects.toBeInstanceOf(ShopError);
    expect(await shopOfOwner(t.db, stranger.id, a.shopId)).toBeNull();
  });

  it("the database keeps exactly one default per owner", async () => {
    const owner = await account(t.db, "db@example.test");
    const a = await saveShopPage(t.db, owner.id, page("db-a"));
    const b = await saveShopPage(t.db, owner.id, page("db-b"), { additional: true, maxShops: 5 });
    await expect(t.db.update(shops).set({ isDefault: true }).where(eq(shops.id, b.shopId))).rejects.toThrow();
    expect((await shopOfOwner(t.db, owner.id))?.id).toBe(a.shopId);
  });
});

describe("the number of shops an owner may run (#265)", () => {
  it("refuses an added shop at the limit, with a stable code, and creates nothing", async () => {
    const owner = await account(t.db, "limit@example.test");
    await saveShopPage(t.db, owner.id, page("l-one"));
    await saveShopPage(t.db, owner.id, page("l-two"), { additional: true, maxShops: 2 });
    await expect(saveShopPage(t.db, owner.id, page("l-three"), { additional: true, maxShops: 2 })).rejects.toMatchObject({ code: "AK_SHOP_LIMIT" });
    expect((await shopsOfOwner(t.db, owner.id)).map((s) => s.slug)).toEqual(["l-one", "l-two"]);
  });

  it("holds under concurrency: simultaneous additions at 1 of 3 create exactly two more, never more", async () => {
    const owner = await account(t.db, "race@example.test");
    await saveShopPage(t.db, owner.id, page("r-one"));
    const results = await Promise.allSettled(Array.from({ length: 6 }, (_, i) => saveShopPage(t.db, owner.id, page(`r-more-${i}`), { additional: true, maxShops: 3 })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect(results.filter((r): r is PromiseRejectedResult => r.status === "rejected").every((r) => r.reason?.code === "AK_SHOP_LIMIT")).toBe(true);
    expect(await shopsOfOwner(t.db, owner.id)).toHaveLength(3);
  });

  it("another owner's shops do not count", async () => {
    const a = await account(t.db, "count-a@example.test");
    const b = await account(t.db, "count-b@example.test");
    await saveShopPage(t.db, a.id, page("c-a1"));
    await saveShopPage(t.db, a.id, page("c-a2"), { additional: true, maxShops: 5 });
    await saveShopPage(t.db, b.id, page("c-b1"));
    await expect(saveShopPage(t.db, b.id, page("c-b2"), { additional: true, maxShops: 2 })).resolves.toMatchObject({ created: true });
  });
});


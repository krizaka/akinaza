import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { shopFormerSlugs, shops } from "./schema";
import { currentSlugOf, saveShopPage, ShopError } from "./service-shop";
import { freshDatabase } from "./test/db";
import { account } from "./test/fixtures";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

const page = (slug: string) => ({ name: "Salon", legalName: "Salon", address: "1 rue Test", slug, ownerName: "Éric" });
const publish = (id: string) => t.db.update(shops).set({ published: true }).where(eq(shops.id, id));

describe("a shop's former addresses (real PostgreSQL 16, #77)", () => {
  it("keeps every former slug leading to the current one, through several renames", async () => {
    const owner = await account(t.db, "rename@example.test");
    const { shopId } = await saveShopPage(t.db, owner.id, page("salon-laurier"));
    await saveShopPage(t.db, owner.id, page("salon-laurier-mtl"));
    await saveShopPage(t.db, owner.id, page("coiffure-laurier"));
    await publish(shopId);
    expect(await currentSlugOf(t.db, "salon-laurier")).toBe("coiffure-laurier");
    expect(await currentSlugOf(t.db, "salon-laurier-mtl")).toBe("coiffure-laurier");
    expect(await currentSlugOf(t.db, "coiffure-laurier")).toBeNull(); // the current slug is not a former one
  });

  it("never lets another shop take a former slug (it would capture the printed links)", async () => {
    const a = await account(t.db, "a@example.test");
    const b = await account(t.db, "b@example.test");
    await saveShopPage(t.db, a.id, page("pattes-st-henri"));
    await saveShopPage(t.db, a.id, page("pattes-saint-henri"));
    await expect(saveShopPage(t.db, b.id, page("pattes-st-henri"))).rejects.toThrow(ShopError);
    await expect(saveShopPage(t.db, b.id, page("pattes-st-henri"))).rejects.toMatchObject({ code: "AK_SLUG_TAKEN" });
  });

  it("lets the same shop take its former slug back, which then is no longer former", async () => {
    const owner = await account(t.db, "back@example.test");
    const { shopId } = await saveShopPage(t.db, owner.id, page("studio-boreal"));
    await saveShopPage(t.db, owner.id, page("boreal-studio"));
    await saveShopPage(t.db, owner.id, page("studio-boreal"));
    expect((await t.db.select().from(shopFormerSlugs).where(eq(shopFormerSlugs.shopId, shopId))).map((r) => r.slug)).toEqual(["boreal-studio"]);
  });

  it("leads nowhere for an unpublished shop, and forgets everything when the shop is deleted", async () => {
    const owner = await account(t.db, "gone@example.test");
    const { shopId } = await saveShopPage(t.db, owner.id, page("ancien-nom"));
    await saveShopPage(t.db, owner.id, page("nouveau-nom"));
    expect(await currentSlugOf(t.db, "ancien-nom")).toBeNull();
    await t.db.delete(shops).where(eq(shops.id, shopId));
    expect(await t.db.select().from(shopFormerSlugs).where(eq(shopFormerSlugs.slug, "ancien-nom"))).toEqual([]);
  });
});

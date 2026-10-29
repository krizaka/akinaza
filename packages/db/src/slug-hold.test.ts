import { parseProtectedTerms } from "@akinaza/core";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { exploreShops } from "./explore";
import { shops } from "./schema";
import { clearSlugHold, currentSlugOf, heldShops, publicShop, saveShopPage } from "./service-shop";
import { freshDatabase } from "./test/db";
import { account } from "./test/fixtures";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

const { terms } = parseProtectedTerms("login\nsecure\npaypal");
const page = (slug: string) => ({ name: "Salon", legalName: "Salon", address: "1 rue Test", slug, ownerName: "Éric" });
const publish = (id: string) => t.db.update(shops).set({ published: true }).where(eq(shops.id, id));
const row = async (id: string) => (await t.db.select().from(shops).where(eq(shops.id, id)))[0]!;

describe("a shop address wearing a protected term is held (ADR-005 slice 4, #537; real PostgreSQL 16)", () => {
  it("holds a lure or look-alike slug, says which term, and leaves a clean slug alone", async () => {
    const owner = await account(t.db, "held1@example.test");
    const held = await saveShopPage(t.db, owner.id, page("mon-l0gin-page"), {}, { terms });
    expect(held).toMatchObject({ created: true, held: true });
    expect(await row(held.shopId)).toMatchObject({ slugHeld: true, slugHeldTerm: "login" });
    const clean = await account(t.db, "clean1@example.test");
    const ok = await saveShopPage(t.db, clean.id, page("pattes-saint-henri"), {}, { terms });
    expect(ok.held).toBe(false);
    expect(await row(ok.shopId)).toMatchObject({ slugHeld: false, slugHeldTerm: null });
  });

  it("is not public on any read while held: the page, the former address, the map", async () => {
    const owner = await account(t.db, "held2@example.test");
    const { shopId } = await saveShopPage(t.db, owner.id, page("salon-laurier"), {}, { terms });
    await publish(shopId);
    expect(await publicShop(t.db, "salon-laurier")).not.toBeNull();
    await saveShopPage(t.db, owner.id, page("secure-laurier"), {}, { terms });
    expect(await publicShop(t.db, "secure-laurier")).toBeNull();
    expect(await currentSlugOf(t.db, "salon-laurier")).toBeNull();
    expect((await exploreShops(t.db, new Date())).map((s) => s.slug)).not.toContain("secure-laurier");
  });

  it("is public again once the administrator clears it, and stays cleared while the slug does not change", async () => {
    const owner = await account(t.db, "held3@example.test");
    const { shopId } = await saveShopPage(t.db, owner.id, page("paypal-toilettage"), {}, { terms });
    await publish(shopId);
    expect((await heldShops(t.db)).map((s) => s.shopId)).toContain(shopId);
    expect(await publicShop(t.db, "paypal-toilettage")).toBeNull();
    await clearSlugHold(t.db, shopId);
    expect(await publicShop(t.db, "paypal-toilettage")).not.toBeNull();
    expect((await heldShops(t.db)).map((s) => s.shopId)).not.toContain(shopId);
    // Saving the page again with the same slug does not hold it a second time.
    const again = await saveShopPage(t.db, owner.id, { ...page("paypal-toilettage"), name: "Toilettage" }, {}, { terms });
    expect(again.held).toBe(false);
    await publish(shopId); // a save without `published` unpublishes; the point here is the hold flag
    expect(await publicShop(t.db, "paypal-toilettage")).not.toBeNull();
  });

  it("holds again when the owner moves a cleared shop to another listed address, and releases a hold when the new slug is clean", async () => {
    const owner = await account(t.db, "held4@example.test");
    const { shopId } = await saveShopPage(t.db, owner.id, page("login-coiffure"), {}, { terms });
    await clearSlugHold(t.db, shopId);
    expect((await saveShopPage(t.db, owner.id, page("secure-coiffure"), {}, { terms })).held).toBe(true);
    expect((await saveShopPage(t.db, owner.id, page("coiffure-laurier"), {}, { terms })).held).toBe(false);
    expect(await row(shopId)).toMatchObject({ slugHeld: false, slugHeldTerm: null });
  });

  it("holds nothing when no terms are given (the seeds, the tests of other features)", async () => {
    const owner = await account(t.db, "held5@example.test");
    expect((await saveShopPage(t.db, owner.id, page("login-seed"))).held).toBe(false);
  });
});

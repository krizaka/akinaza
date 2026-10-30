import { parseProtectedTerms } from "@akinaza/core";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { exploreShops } from "./explore";
import { shops } from "./schema";
import { currentSlugOf, publicShop, saveShopPage } from "./service-shop";
import { clearSlugHold, heldShops, keepSlugHold, rejudgeShops } from "./slug-review";
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

  it("keeps a held shop out of the Explorer read model, and puts it back once cleared (0047)", async () => {
    const inIndex = async (id: string) => (await t.db.execute(sql`SELECT 1 FROM shop_search WHERE shop_id = ${id}`)).rows.length === 1;
    const owner = await account(t.db, "held6@example.test");
    const { shopId } = await saveShopPage(t.db, owner.id, page("paypal-explorer"), {}, { terms });
    await publish(shopId);
    expect(await inIndex(shopId)).toBe(false);
    await clearSlugHold(t.db, shopId);
    expect(await inIndex(shopId)).toBe(true);
    await t.db.update(shops).set({ slugHeld: true, slugHeldTerm: "paypal", slugHeldAt: new Date() }).where(eq(shops.id, shopId));
    expect(await inIndex(shopId)).toBe(false);
  });

  it("holds nothing when no terms are given (the seeds, the tests of other features)", async () => {
    const owner = await account(t.db, "held5@example.test");
    expect((await saveShopPage(t.db, owner.id, page("login-seed"))).held).toBe(false);
  });
});

describe("the pace of address changes (ADR-005 slice 4, #537; real PostgreSQL 16)", () => {
  const pace = { slugChanges: { max: 2, days: 7 } };
  const changes = (id: string) => t.pool.query("SELECT count(*)::int AS n FROM shop_slug_changes WHERE shop_id = $1", [id]).then((r) => r.rows[0].n as number);

  it("lets a shop change its address up to the bound in the window, then refuses with AK_SLUG_RATE_LIMIT and leaves the shop as it was", async () => {
    const owner = await account(t.db, "pace1@example.test");
    const { shopId } = await saveShopPage(t.db, owner.id, page("pace-un"), {}, pace);
    expect(await changes(shopId)).toBe(0); // the first address is not a change
    await saveShopPage(t.db, owner.id, page("pace-deux"), {}, pace);
    await saveShopPage(t.db, owner.id, page("pace-trois"), {}, pace);
    await expect(saveShopPage(t.db, owner.id, page("pace-quatre"), {}, pace)).rejects.toMatchObject({ code: "AK_SLUG_RATE_LIMIT" });
    expect((await row(shopId)).slug).toBe("pace-trois");
    expect(await changes(shopId)).toBe(2);
  });

  it("does not count a save that keeps the address, and lets the other fields change at the bound", async () => {
    const owner = await account(t.db, "pace2@example.test");
    const { shopId } = await saveShopPage(t.db, owner.id, page("pace-a"), {}, pace);
    await saveShopPage(t.db, owner.id, page("pace-b"), {}, pace);
    await saveShopPage(t.db, owner.id, page("pace-c"), {}, pace);
    await saveShopPage(t.db, owner.id, { ...page("pace-c"), name: "Autre nom" }, {}, pace);
    expect((await row(shopId)).name).toBe("Autre nom");
  });

  it("counts only the window: older changes leave it, so the shop may change again", async () => {
    const owner = await account(t.db, "pace3@example.test");
    const { shopId } = await saveShopPage(t.db, owner.id, page("old-a"), {}, pace);
    await saveShopPage(t.db, owner.id, page("old-b"), {}, pace);
    await saveShopPage(t.db, owner.id, page("old-c"), {}, pace);
    await t.pool.query("UPDATE shop_slug_changes SET at = now() - interval '8 days' WHERE shop_id = $1", [shopId]);
    await saveShopPage(t.db, owner.id, page("old-d"), {}, pace);
    expect((await row(shopId)).slug).toBe("old-d");
  });

  it("is per shop: another shop of the same owner has its own count", async () => {
    const owner = await account(t.db, "pace4@example.test");
    await saveShopPage(t.db, owner.id, page("duo-a"), {}, pace);
    await saveShopPage(t.db, owner.id, page("duo-b"), {}, pace);
    await saveShopPage(t.db, owner.id, page("duo-c"), {}, pace);
    const second = await saveShopPage(t.db, owner.id, page("duo-x"), { additional: true, maxShops: 5 }, pace);
    await saveShopPage(t.db, owner.id, page("duo-y"), { shopId: second.shopId }, pace);
    expect((await row(second.shopId)).slug).toBe("duo-y");
  });

  it("sets no pace when none is given (seeds and other tests)", async () => {
    const owner = await account(t.db, "pace5@example.test");
    let shopId = "";
    for (const slug of ["free-a", "free-b", "free-c", "free-d", "free-e"]) shopId = (await saveShopPage(t.db, owner.id, page(slug))).shopId;
    expect((await row(shopId)).slug).toBe("free-e");
  });
});

describe("the administrator's review of held addresses (ADR-005 slice 4, #537)", () => {
  it("keeps a hold with a reason, shown in the queue with the owner and the matched term", async () => {
    const owner = await account(t.db, "review1@example.test");
    const { shopId } = await saveShopPage(t.db, owner.id, page("verify-toilettage"), {}, { terms: parseProtectedTerms("verify").terms });
    expect(await keepSlugHold(t.db, shopId, "  Looks like a phishing page  ")).toBe(true);
    const queued = (await heldShops(t.db)).find((s) => s.shopId === shopId);
    expect(queued).toMatchObject({ term: "verify", ownerEmail: "review1@example.test", note: "Looks like a phishing page" });
    expect(queued?.reviewedAt).toBeInstanceOf(Date);
    expect(await keepSlugHold(t.db, "00000000-0000-4000-8000-000000000000", "x")).toBe(false);
  });

  it("re-judges the shops that predate the hold: a dry run reports and changes nothing, apply holds them, a cleared address is never held again", async () => {
    const old = await account(t.db, "rejudge1@example.test");
    const cleared = await account(t.db, "rejudge2@example.test");
    const fine = await account(t.db, "rejudge3@example.test");
    const a = await saveShopPage(t.db, old.id, page("wallet-salon"), {});
    const b = await saveShopPage(t.db, cleared.id, page("wallet-chiens"), {});
    await saveShopPage(t.db, fine.id, page("pattes-rosemont"), {});
    const wallet = parseProtectedTerms("wallet").terms;
    // The administrator already looked at b: hold it by hand, then clear it.
    await t.db.update(shops).set({ slugHeld: true, slugHeldTerm: "wallet", slugHeldAt: new Date() }).where(eq(shops.id, b.shopId));
    expect(await clearSlugHold(t.db, b.shopId)).toBe(true);

    const dry = await rejudgeShops(t.db, wallet, { apply: false });
    expect(dry.map((s) => s.slug)).toEqual(["wallet-salon"]);
    expect(dry[0]).toMatchObject({ matched: "wallet", ownerEmail: "rejudge1@example.test", ownerLocale: "fr" });
    expect((await row(a.shopId)).slugHeld).toBe(false);

    const applied = await rejudgeShops(t.db, wallet, { apply: true });
    expect(applied.map((s) => s.shopId)).toEqual([a.shopId]);
    expect(await row(a.shopId)).toMatchObject({ slugHeld: true, slugHeldTerm: "wallet" });
    expect((await row(b.shopId)).slugHeld).toBe(false);
    expect(await rejudgeShops(t.db, wallet, { apply: true })).toEqual([]);
  });
});

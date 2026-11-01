import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { organizeMigration } from "@krizaka/organize";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ORGANIZE_MIGRATION_HEADER } from "./gen-organize-migration";
import { ORGANIZE_SCHEMA, organizeOver, SHOP_AVATAR_SEEDS } from "./organize";
import { saveShopPage, setDefaultShop, shopsOfOwner } from "./service-shop";
import { freshDatabase } from "./test/db";
import { account } from "./test/fixtures";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

const page = (slug: string) => ({ name: slug, legalName: slug, address: "1 rue Test", slug, ownerName: "Éric" });
const org = () => organizeOver(async (sql, params) => (await t.pool.query(sql, params as unknown[])).rows);
const RULES = { allowedSeeds: SHOP_AVATAR_SEEDS };

describe("a shop is an item of « organize »", () => {

  it("an owner has a default collection (in their language) and a new shop falls into it", async () => {
    const owner = await account(t.db, "orga@example.test");
    const { shopId } = await saveShopPage(t.db, owner.id, page("orga-1"));
    const o = org();
    const [def] = (await o.collections.list(owner.id)).filter((c) => c.isDefault);
    expect(def!.name).toBe("Mes commerces");
    expect((await o.profile("shop").get(owner.id, shopId)).collectionId).toBe(def!.id);
  });

  it("gives a shop a description, an avatar and tags, and groups shops into collections of the owner", async () => {
    const owner = await account(t.db, "orga2@example.test");
    const a = (await saveShopPage(t.db, owner.id, page("orga-a"))).shopId;
    const b = (await saveShopPage(t.db, owner.id, page("orga-b"), { additional: true, maxShops: 50 })).shopId;
    const o = org();
    await o.profile("shop").describe(owner.id, a, "  Le salon du centre  ");
    await o.profile("shop").setAvatar(owner.id, a, "plain-3", RULES);
    await expect(o.profile("shop").setAvatar(owner.id, a, "nope", RULES)).rejects.toMatchObject({ code: "AVATAR_NOT_ALLOWED" });
    const tag = await o.tags.create(owner.id, { name: "centre", color: "blue" });
    await o.tags.assign(owner.id, "shop", a, [tag.id]);
    const group = await o.collections.create(owner.id, { name: "Montréal" });
    await o.profile("shop").setCollection(owner.id, b, group.id);
    expect(await o.profile("shop").get(owner.id, a)).toMatchObject({ description: "Le salon du centre", avatar: { kind: "set", seed: "plain-3" } });
    expect([...(await o.tags.of(owner.id, "shop", [a, b])).entries()].map(([id, tags]) => [id === a, tags.map((x) => x.name)])).toEqual([[true, ["centre"]]]);
    expect((await o.profile("shop").get(owner.id, b)).collectionId).toBe(group.id);
    // the current shop is another matter: it moves without touching the collections
    await setDefaultShop(t.db, owner.id, b);
    expect((await shopsOfOwner(t.db, owner.id))[0]!.id).toBe(b);
    expect((await o.profile("shop").get(owner.id, b)).collectionId).toBe(group.id);
  });

  it("never lets one owner touch another's shop, and never deletes the default collection", async () => {
    const owner = await account(t.db, "orga3@example.test");
    const stranger = await account(t.db, "orga4@example.test");
    const s = (await saveShopPage(t.db, owner.id, page("orga-c"))).shopId;
    const o = org();
    await expect(o.profile("shop").describe(stranger.id, s, "mine")).rejects.toMatchObject({ code: "NOT_FOUND" });
    const [def] = (await o.collections.list(owner.id)).filter((c) => c.isDefault);
    await expect(o.collections.remove(owner.id, def!.id)).rejects.toBeTruthy();
  });
});

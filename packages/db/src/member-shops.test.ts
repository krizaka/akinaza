import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { memberships } from "./schema";
import { shopOfMember, shopsOfMember } from "./service-shop";
import { freshDatabase } from "./test/db";
import { account, walkerShop } from "./test/fixtures";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

describe("the shops an account works in", () => {
  it("lists the shops with the role there, the owned one first, and opens the one asked for only to a member", async () => {
    const mine = await walkerShop(t.db, "own");
    const other = await walkerShop(t.db, "other");
    await t.db.insert(memberships).values({ scopeId: other.shopId, accountId: mine.owner.id, role: "staff", createdAt: new Date() });

    const shops = await shopsOfMember(t.db, mine.owner.id);
    expect(shops.map((s) => s.role)).toEqual(["owner", "staff"]);
    expect(shops[0]!.id).toBe(mine.shopId);

    expect((await shopOfMember(t.db, mine.owner.id, other.shopId))?.role).toBe("staff");
    const stranger = await account(t.db, "stranger@example.test");
    expect(await shopOfMember(t.db, stranger.id, other.shopId)).toBeNull();
    expect(await shopsOfMember(t.db, stranger.id)).toEqual([]);
  });
});

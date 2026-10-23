import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { publicShop } from "./service-shop";
import { freshDatabase } from "./test/db";
import { walkerShop } from "./test/fixtures";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

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

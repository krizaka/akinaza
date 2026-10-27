import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { saveShopFigureOverrides, shopFigureOverrides } from "./shop-figure-thresholds";
import { freshDatabase } from "./test/db";
import { walkerShop } from "./test/fixtures";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

describe("the owner's figure thresholds (#260)", () => {
  it("is empty until the owner changes something", async () => {
    const shop = await walkerShop(t.db, "rules-empty");
    expect(await shopFigureOverrides(t.db, shop.shopId)).toEqual({});
  });

  it("keeps what was changed, replaces it on the next save and returns to the defaults when emptied", async () => {
    const shop = await walkerShop(t.db, "rules-saved");
    expect(await saveShopFigureOverrides(t.db, shop.shopId, { overdueWatchPct: 5, taxPeriodSoonDays: 30 })).toEqual({ overdueWatchPct: 5, taxPeriodSoonDays: 30 });
    expect(await shopFigureOverrides(t.db, shop.shopId)).toEqual({ overdueWatchPct: 5, taxPeriodSoonDays: 30 });
    await saveShopFigureOverrides(t.db, shop.shopId, { marginWatchPct: 40 });
    expect(await shopFigureOverrides(t.db, shop.shopId)).toEqual({ marginWatchPct: 40 });
    await saveShopFigureOverrides(t.db, shop.shopId, {});
    expect(await shopFigureOverrides(t.db, shop.shopId)).toEqual({});
  });

  it("refuses what is out of bounds or not tunable, without touching the amounts", async () => {
    const shop = await walkerShop(t.db, "rules-bounds");
    expect(await saveShopFigureOverrides(t.db, shop.shopId, { overdueWatchPct: 0, noShowWatchPct: 100, maxActions: 9, gst: 1 })).toEqual({});
    expect(await shopFigureOverrides(t.db, shop.shopId)).toEqual({});
  });

  it("belongs to one shop: another shop never sees it, and it goes with the shop", async () => {
    const a = await walkerShop(t.db, "rules-a");
    const b = await walkerShop(t.db, "rules-b");
    await saveShopFigureOverrides(t.db, a.shopId, { overdueWatchPct: 7 });
    expect(await shopFigureOverrides(t.db, b.shopId)).toEqual({});
  });
});

import { describe, expect, it } from "vitest";

import { setUpNewShop } from "./new-shop-setup";

describe("setUpNewShop (a retry after a failed setup never creates a second shop)", () => {
  it("creates the shop once, then configures it again on a retry with the same id", async () => {
    const state = { shopId: null as string | null };
    const created: string[] = [];
    const configured: string[] = [];
    const create = async () => {
      created.push("shop-1");
      return "shop-1";
    };
    let failures = 1;
    const configure = async (shopId: string) => {
      configured.push(shopId);
      if (failures-- > 0) throw new Error("templates switched off");
    };

    await expect(setUpNewShop(state, create, configure)).rejects.toThrow("templates switched off");
    expect(state.shopId).toBe("shop-1");

    await expect(setUpNewShop(state, create, configure)).resolves.toBe("shop-1");
    expect(created).toEqual(["shop-1"]);
    expect(configured).toEqual(["shop-1", "shop-1"]);
  });
});

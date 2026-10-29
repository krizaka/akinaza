import { describe, expect, it, vi } from "vitest";

import { createShopDirectory, forgetShops, type ShopVerdict, verdictFromAnswer } from "./shop-directory";

/** ADR-005 slice 4 (akinaza#549): the proxy asks whether a shop host names a shop, through a short, bounded memory. */
describe("the shop directory", () => {
  it("reads the internal route's answer", () => {
    expect(verdictFromAnswer({ slug: "salon" })).toEqual({ kind: "shop" });
    expect(verdictFromAnswer({ moved: "salon-neuf" })).toEqual({ kind: "moved", slug: "salon-neuf" });
    expect(verdictFromAnswer({})).toEqual({ kind: "none" });
    expect(verdictFromAnswer(null)).toEqual({ kind: "unknown" });
  });

  it("keeps a shop a minute and an unknown address ten seconds (a new shop is reachable at once), asking once in between", async () => {
    let clock = 0;
    const lookup = vi.fn(async (slug: string): Promise<ShopVerdict> => (slug === "salon" ? { kind: "shop" } : { kind: "none" }));
    const verdictOf = createShopDirectory(lookup, () => clock);
    expect(await verdictOf("salon")).toEqual({ kind: "shop" });
    expect(await verdictOf("nobody")).toEqual({ kind: "none" });
    clock = 9_000;
    await verdictOf("salon");
    await verdictOf("nobody");
    expect(lookup).toHaveBeenCalledTimes(2);
    clock = 11_000;
    await verdictOf("nobody");
    await verdictOf("salon");
    expect(lookup).toHaveBeenCalledTimes(3);
    clock = 61_000;
    await verdictOf("salon");
    expect(lookup).toHaveBeenCalledTimes(4);
  });

  it("never caches a failed lookup and never refuses because of it (the page layer answers 404 for an unknown shop all the same)", async () => {
    const lookup = vi.fn<(slug: string) => Promise<ShopVerdict>>().mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce({ kind: "shop" });
    const verdictOf = createShopDirectory(lookup);
    expect(await verdictOf("salon")).toEqual({ kind: "unknown" });
    expect(await verdictOf("salon")).toEqual({ kind: "shop" });
  });

  it("holds at most a thousand addresses: a flood of random labels costs misses, not memory", async () => {
    const lookup = vi.fn(async (): Promise<ShopVerdict> => ({ kind: "none" }));
    const verdictOf = createShopDirectory(lookup, () => 0);
    for (let i = 0; i < 1100; i++) {await verdictOf(`label-${i}`);}
    lookup.mockClear();
    await verdictOf("label-1099");
    expect(lookup).not.toHaveBeenCalled();
    await verdictOf("label-0");
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it("forgets at once when a shop is published, held or renamed, even if another module graph asks (a shared memory), so a held shop stops answering within the request", async () => {
    let held = false;
    const lookup = vi.fn(async (): Promise<ShopVerdict> => (held ? { kind: "none" } : { kind: "shop" }));
    const proxySide = createShopDirectory(lookup); // the proxy's directory: the memory is the process's
    expect(await proxySide("salon")).toEqual({ kind: "shop" });
    held = true;
    expect(await proxySide("salon")).toEqual({ kind: "shop" }); // cached: that is the point of the TTL
    forgetShops(); // what the publish / rename / hold routes call
    expect(await proxySide("salon")).toEqual({ kind: "none" });
    forgetShops();
  });
});

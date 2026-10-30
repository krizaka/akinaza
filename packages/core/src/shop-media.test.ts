import { describe, expect, it } from "vitest";

import { DEFAULT_MEDIA, DEFAULT_SLOT_IDS, DEFAULT_SLOTS, defaultMediaPaths, defaultsFor, SHOP_TYPES, shopTypeOf } from "./shop-media";

describe("the default media of the storefronts (#267)", () => {
  it("names the trades Akinaza serves, never a restaurant or a bar", () => {
    expect(SHOP_TYPES).toEqual(["salon", "coaching", "workshop", "cleaning", "pets", "consulting"]);
    for (const banned of ["restaurant", "cafe", "bar", "bakery"]) expect(SHOP_TYPES as readonly string[]).not.toContain(banned);
  });

  it("every shop type has at least one default for every slot, as many as the slot says", () => {
    for (const type of SHOP_TYPES) {
      for (const slot of DEFAULT_SLOT_IDS) {
        expect(defaultsFor(type, slot).length, `${type}/${slot}`).toBe(DEFAULT_SLOTS[slot].count);
        expect(defaultsFor(type, slot).length).toBeGreaterThanOrEqual(1);
      }
    }
    expect(DEFAULT_MEDIA).toHaveLength(SHOP_TYPES.length * DEFAULT_SLOT_IDS.reduce((n, slot) => n + DEFAULT_SLOTS[slot].count, 0));
  });

  it("ids, alt keys and file paths are unique, and every path sits under the Akinaza defaults prefix", () => {
    expect(new Set(DEFAULT_MEDIA.map((m) => m.id)).size).toBe(DEFAULT_MEDIA.length);
    expect(new Set(DEFAULT_MEDIA.map((m) => m.altKey)).size).toBe(DEFAULT_MEDIA.length);
    const paths = defaultMediaPaths();
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) expect(path).toMatch(/^defaults\/(salon|coaching|workshop|cleaning|pets|consulting)\/(cover|gallery|service)\/[a-z0-9-]+\.(avif|webp|webm|mp4)$/);
  });

  it("the cover has its loop and poster, the others only images, each image in AVIF and WebP at every width of its slot", () => {
    for (const m of DEFAULT_MEDIA) {
      expect(Boolean(m.files.video), m.id).toBe(m.slot === "cover");
      for (const width of DEFAULT_SLOTS[m.slot].widths) for (const format of ["avif", "webp"] as const) expect(m.files.images.some((f) => f.width === width && f.format === format), `${m.id} ${width} ${format}`).toBe(true);
    }
  });

  it("a shop with no chosen type takes its business type's: pets, else professional services", () => {
    expect(shopTypeOf("pets")).toBe("pets");
    expect(shopTypeOf("professional")).toBe("consulting");
    expect(shopTypeOf("professional", "salon")).toBe("salon");
    expect(shopTypeOf("pets", "coaching")).toBe("coaching");
    expect(shopTypeOf("pets", "restaurant")).toBe("pets");
    expect(shopTypeOf("professional", null)).toBe("consulting");
  });
});

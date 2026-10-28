import { documentFromLegacy } from "@akinaza/core";
import { shopStarters } from "@krizaka/ui/shop";
import { describe, expect, it } from "vitest";

import { type PhotoPool, placedAddresses, planPhotos } from "./shop-page-media";

const photo = (n: number) => ({ id: `p${n}`, src: `https://cdn.example/${n}.webp?w=960`, alt: `Photo ${n}` });
const all = ["services", "team", "hours", "zones", "trust", "gallery", "wall", "reels", "announcements", "reviews", "follow"].map((id) => ({ id, visible: true }));

describe("no duplicate photo on a page (akinaza#401)", () => {
  it("gives the cover to the hero and keeps it out of the gallery and the wall, whatever the sizes in the address", () => {
    const pool: PhotoPool = { cover: { src: "https://cdn.example/1.webp", alt: "Cover" }, gallery: [photo(1), photo(2), photo(3)], wall: [photo(3), photo(4), { ...photo(2), id: "w2" }] };
    const plan = planPhotos(documentFromLegacy({ sections: all, trade: "salon" }), pool);
    expect(plan.cover?.alt).toBe("Cover");
    expect(plan.sections.s_gallery!.map((p) => p.id)).toEqual(["p2", "p3"]);
    expect(plan.sections.s_wall!.map((p) => p.id)).toEqual(["p4"]);
    const addresses = placedAddresses(plan);
    expect(new Set(addresses).size).toBe(addresses.length);
  });

  it("holds for every starter, with the same photo offered to every gallery", () => {
    for (const [name, starter] of Object.entries(shopStarters)) {
      const pool: PhotoPool = { cover: photo(0), gallery: [0, 1, 2, 3, 4, 5].map(photo), wall: [0, 1, 2, 3, 4, 5].map(photo) };
      const addresses = placedAddresses(planPhotos(starter, pool));
      expect(new Set(addresses).size, name).toBe(addresses.length);
    }
  });

  it("gives nothing to a disabled section, so a hidden gallery does not hide a photo from the next", () => {
    const doc = documentFromLegacy({ sections: all.map((s) => ({ ...s, visible: s.id !== "gallery" })), trade: "salon" });
    const plan = planPhotos(doc, { cover: null, gallery: [photo(1)], wall: [photo(1)] });
    expect(plan.sections.s_gallery).toBeUndefined();
    expect(plan.sections.s_wall!.map((p) => p.id)).toEqual(["p1"]);
  });

  it("keeps a gallery to 12 photos", () => {
    const doc = documentFromLegacy({ sections: all, trade: "salon" });
    const plan = planPhotos(doc, { cover: null, gallery: Array.from({ length: 20 }, (_, i) => photo(i)), wall: [] });
    expect(plan.sections.s_gallery).toHaveLength(12);
  });
});

describe("the closing call's photo (akinaza#480)", () => {
  const closing = { schema: 1, preset: { id: "salon-vitrine", version: 1 }, sections: [{ key: "s_hero", type: "hero", variant: "poster", settings: { focus: "center" } }, { key: "s_gallery", type: "gallery", variant: "grid", settings: { source: "all" } }, { key: "s_booking_closing", type: "booking", variant: "closing", settings: { count: 4 } }] };
  it("is a photo no earlier section drew, the cover and the gallery included", () => {
    const plan = planPhotos(closing as never, { cover: photo(0), gallery: Array.from({ length: 14 }, (_, i) => photo(i)), wall: [] });
    expect(plan.sections.s_booking_closing!.map((p) => p.id)).toEqual(["p13"]);
    const addresses = placedAddresses(plan);
    expect(new Set(addresses).size).toBe(addresses.length);
  });
  it("is absent when the page already shows every photo: the shop's mark stands in", () => {
    const plan = planPhotos(closing as never, { cover: photo(0), gallery: [photo(0), photo(1)], wall: [] });
    expect(plan.sections.s_booking_closing).toBeUndefined();
  });
});

describe("a video's poster", () => {
  it("is left out when the page already draws that picture, and claimed once otherwise", async () => {
    const { photoLedger } = await import("./shop-page-media");
    const plan = planPhotos(documentFromLegacy({ sections: all, trade: "salon" }), { cover: photo(1), gallery: [photo(2)], wall: [] });
    const claim = photoLedger(plan);
    expect(claim(photo(1).src)).toBeUndefined();
    expect(claim(photo(2).src)).toBeUndefined();
    expect(claim(photo(9).src)).toBe(photo(9).src);
    expect(claim(photo(9).src)).toBeUndefined();
    expect(claim(null)).toBeUndefined();
  });
});

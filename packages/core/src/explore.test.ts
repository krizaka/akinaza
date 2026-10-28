import { describe, expect, it } from "vitest";

import { distanceBetween, type ExploreShop, filterShops, isOpenNow, NO_FILTERS, quartiersOf, rankByDistance } from "./explore";

const shop = (slug: string, over: Partial<ExploreShop> = {}): ExploreShop => ({ slug, name: slug, kind: "salon", area: null, taglineFr: null, taglineEn: null, quartiers: [], point: null, openNow: false, freeToday: false, ...over });

describe("distance", () => {
  it("is zero from a point to itself and about 3.5 km from the Old Port to Saint-Henri", () => {
    const oldPort: [number, number] = [-73.5496, 45.5017];
    const stHenri: [number, number] = [-73.5848, 45.4797];
    expect(distanceBetween(oldPort, oldPort)).toBe(0);
    expect(distanceBetween(oldPort, stHenri)).toBeGreaterThan(3000);
    expect(distanceBetween(oldPort, stHenri)).toBeLessThan(4000);
  });
});

describe("open now (in the shop's own zone)", () => {
  const windows = [{ weekday: 2, startsAt: "09:00:00", endsAt: "17:00:00" }];
  it("is open inside a window, closed at its end and outside", () => {
    expect(isOpenNow(windows, [], "America/Toronto", new Date("2026-10-27T14:00:00Z"))).toBe(true); // Tuesday 10:00 local
    expect(isOpenNow(windows, [], "America/Toronto", new Date("2026-10-27T21:00:00Z"))).toBe(false); // 17:00 local: closed
    expect(isOpenNow(windows, [], "America/Toronto", new Date("2026-10-28T14:00:00Z"))).toBe(false); // Wednesday
  });
  it("is closed on a day off, and reads the hours in the shop's zone, not the server's", () => {
    expect(isOpenNow(windows, ["2026-10-27"], "America/Toronto", new Date("2026-10-27T14:00:00Z"))).toBe(false);
    expect(isOpenNow(windows, [], "America/Vancouver", new Date("2026-10-27T14:00:00Z"))).toBe(false); // 07:00 there
  });
});

describe("filters", () => {
  const list = [shop("a", { kind: "salon", openNow: true }), shop("b", { kind: "boutique", freeToday: true }), shop("c", { kind: "salon", openNow: true, freeToday: true })];
  it("keeps everything with no filter on", () => expect(filterShops(list, NO_FILTERS)).toHaveLength(3));
  it("combines kind, open now and a free slot today", () => {
    expect(filterShops(list, { ...NO_FILTERS, kind: "salon" }).map((s) => s.slug)).toEqual(["a", "c"]);
    expect(filterShops(list, { ...NO_FILTERS, openNow: true, freeToday: true }).map((s) => s.slug)).toEqual(["c"]);
    expect(filterShops(list, { kind: "boutique", openNow: true, freeToday: false })).toEqual([]);
  });
});

describe("ranking by distance", () => {
  const origin: [number, number] = [-73.58, 45.48];
  const list = [shop("far", { point: [-73.4, 45.6] }), shop("nopoint"), shop("near", { point: [-73.581, 45.481] }), shop("mid", { point: [-73.55, 45.5] })];
  it("puts the nearest first and the shops with no position last", () => {
    const r = rankByDistance(list, origin);
    expect(r.map((s) => s.slug)).toEqual(["near", "mid", "far", "nopoint"]);
    expect(r[0]!.distanceMeters).toBeLessThan(r[1]!.distanceMeters!);
    expect(r[3]!.distanceMeters).toBeNull();
  });
  it("invents no ranking without an origin: the name's order, no distance", () => {
    const r = rankByDistance(list, null);
    expect(r.map((s) => s.slug)).toEqual(["far", "mid", "near", "nopoint"]);
    expect(r.every((s) => s.distanceMeters === null)).toBe(true);
  });
  it("lists the distinct quartiers, sorted", () => {
    expect(quartiersOf([shop("a", { quartiers: ["Verdun", "Griffintown"] }), shop("b", { quartiers: ["Verdun"] })])).toEqual(["Griffintown", "Verdun"]);
  });
});

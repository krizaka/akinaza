import type { FeedFlyerRow } from "@akinaza/db";
import { describe, expect, it } from "vitest";

import { buildFeed } from "./feed-view";

let n = 0;
const row = (over: Partial<FeedFlyerRow> = {}): FeedFlyerRow => ({ id: `f${++n}`, textFr: "Portes ouvertes samedi", textEn: "Open day on Saturday", photoUrl: null, photoAlt: "", endsOn: null, createdAt: new Date("2026-10-20T12:00:00Z"), shopName: "Pattes de Saint-Henri", shopSlug: "pattes", area: "Saint-Henri, Montréal", ...over });

describe("the neighbourhood feed (#318)", () => {
  it("speaks the language asked and leads each flyer to its shop's page in that language", () => {
    const fr = buildFeed({ rows: [row()], locale: "fr" });
    const en = buildFeed({ rows: [row()], locale: "en" });
    expect(fr.flyers[0]).toMatchObject({ text: "Portes ouvertes samedi", shop: { name: "Pattes de Saint-Henri", href: "/fr/s/pattes" } });
    expect(en.flyers[0]).toMatchObject({ text: "Open day on Saturday", shop: { href: "/en/s/pattes" } });
  });

  it("falls back to the other language when the flyer was written in one", () => {
    expect(buildFeed({ rows: [row({ textEn: "" })], locale: "en" }).flyers[0]!.text).toBe("Portes ouvertes samedi");
  });

  it("states the last day in words", () => {
    expect(buildFeed({ rows: [row({ endsOn: "2026-12-03" })], locale: "en" }).flyers[0]!.until).toBe("Until December 3");
    expect(buildFeed({ rows: [row({ endsOn: "2026-12-03" })], locale: "fr" }).flyers[0]!.until).toBe("Jusqu'au 3 décembre");
  });

  it("filters by neighbourhood, ignoring accents and case, and still lists every neighbourhood as a chip", () => {
    const rows = [row({ id: "a" }), row({ id: "b", shopSlug: "v", area: "Villeray, Montréal" }), row({ id: "c", shopSlug: "c", area: "Côte-des-Neiges, Montréal" })];
    const view = buildFeed({ rows, locale: "fr", quartier: "cote des neiges" });
    expect(view.flyers.map((f) => f.id)).toEqual(["c"]);
    expect(view.quartiers).toEqual(["Côte-des-Neiges", "Saint-Henri", "Villeray"]);
    expect(view.quartier).toBe("cote des neiges");
  });

  it("answers an empty neighbourhood with no flyers, not an error", () => {
    expect(buildFeed({ rows: [row()], locale: "en", quartier: "Hochelaga" }).flyers).toEqual([]);
  });

  it("shows two flyers of one shop at most and nine in all", () => {
    const busy = Array.from({ length: 5 }, () => row());
    expect(buildFeed({ rows: busy, locale: "en" }).flyers).toHaveLength(2);
    const many = Array.from({ length: 20 }, (_, i) => row({ shopSlug: `s${i}` }));
    expect(buildFeed({ rows: many, locale: "en" }).flyers).toHaveLength(9);
  });
});

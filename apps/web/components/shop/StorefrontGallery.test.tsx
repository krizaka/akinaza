import { documentFromLegacy } from "@akinaza/core";
import { type PublicShop } from "@akinaza/db";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { buildStorefront } from "@/lib/storefront";

import { ShopPageView } from "./ShopPageView";

const NOW = new Date("2026-10-19T10:30:00-04:00");

const photo = (n: number) => ({ id: `g${n}`, url: `https://cdn.test/g${n}.webp`, webmUrl: null, mp4Url: null, altFr: `Photo ${n}`, altEn: `Picture ${n}`, captionFr: null, captionEn: null, wide: false });

/** A shop with `count` photos of its own in the gallery (the default composition draws it as a mosaic). */
const shop = (count: number): PublicShop => ({
  shop: { id: "w", name: "Pattes de Saint-Henri", slug: "pattes", timezone: "America/Toronto", registrant: true, taglineFr: "Des promenades.", taglineEn: "Dog walks.", area: null, bioFr: null, bioEn: null, publicPhone: null, publicEmail: null, seatUnitFr: null, seatUnitEn: null, businessType: "pets", ownerName: "Léa" },
  zones: [],
  services: [{ id: "solo", nameFr: "Solo", nameEn: "Solo", durationMinutes: 30, priceCents: 2_200, capacity: 1, descriptionFr: null, descriptionEn: null, includedFr: [], includedEn: [], priceVaries: false }],
  windows: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startsAt: "08:00", endsAt: "17:00" })),
  daysOff: [],
  rules: { cancellationHours: 24, bookingHorizonDays: 60 },
  media: { cover: null, gallery: Array.from({ length: count }, (_, i) => photo(i + 1)) },
  team: [],
  popularServiceId: null,
  languages: { source: "fr", enabled: ["fr", "en"] },
  translations: [],
});

type Variant = "mosaic" | "filmstrip" | "grid";
const render = (count: number, locale: "fr" | "en", variant: Variant = "mosaic") => {
  const view = buildStorefront({ page: shop(count), locale, now: NOW });
  const doc = documentFromLegacy({ sections: view.sections, trade: "salon" });
  const page = { ...doc, sections: doc.sections.map((s) => (s.type === "gallery" ? { ...s, variant } : s)) };
  return renderToStaticMarkup(<ShopPageView page={page} view={view} locale={locale} today="2026-10-19" />);
};

describe("the gallery's mosaic is the ShopGallery of @krizaka/ui (akinaza#481)", () => {
  const html = render(7, "en");
  it("draws one named tile button per photo, in a group named after the shop, with the lightbox closed (no dialog in the markup)", () => {
    expect(html).toContain('class="kz-sg');
    expect(html).toContain('aria-label="Photos of Pattes de Saint-Henri"');
    expect(html.match(/class="kz-sg-tile"/g)).toHaveLength(7);
    expect(html).toContain("Open photo 1 of 7: Picture 1");
    expect(html).not.toContain('role="dialog"');
  });
  it("folds the surplus into the fifth tile (« + 3 photos »)", () => {
    expect(html).toContain("+ 3 photos");
  });
  it("shows each photo once", () => {
    for (let n = 1; n <= 7; n++) expect(html.split(`https://cdn.test/g${n}.webp`).length - 1).toBe(1);
  });
  it("reads in French when the page is French", () => {
    const fr = render(3, "fr");
    expect(fr).toContain("Ouvrir la photo 1 sur 3");
    expect(fr).not.toContain("Open photo");
  });
  it("is gone when the shop has no photo (no empty gallery)", () => {
    expect(render(0, "en")).not.toContain("kz-sg");
  });
  it("no longer draws the plain mosaic list", () => {
    expect(html).not.toContain("sm:grid-cols-[1.6fr_1fr_1fr]");
  });
  it("leaves the other variants to the section (filmstrip, grid)", () => {
    expect(render(3, "en", "filmstrip")).not.toContain("kz-sg");
    expect(render(3, "en", "grid")).not.toContain("kz-sg");
  });
  it("keeps the section's heading and anchor around the gallery", () => {
    expect(html).toContain('id="s_gallery"');
    expect(html).toContain("Photos of Pattes de Saint-Henri</h2>");
  });
});

import type { PublicShop } from "@akinaza/db";
import { describe, expect, it } from "vitest";

import { bindProduct } from "@/lib/brand";
import frRaw from "@/messages/fr.json";

import { buildStorefront } from "./storefront";

const fr = bindProduct(frRaw);

const NOW = new Date("2026-10-19T14:30:00Z");
const page = (over: Partial<PublicShop> = {}): PublicShop => ({
  shop: { id: "shop-1", name: "Salon Laurier", slug: "salon-laurier", timezone: "America/Toronto", registrant: true, taglineFr: "Coiffure de quartier", taglineEn: null, area: null, bioFr: "Julie vous reçoit.", bioEn: null, publicPhone: null, publicEmail: null, seatUnitFr: null, seatUnitEn: null, businessType: "professional", ownerName: "Julie" },
  zones: [],
  services: [{ id: "cut", nameFr: "Coupe", nameEn: "Haircut", durationMinutes: 45, priceCents: 4_500, capacity: 1, descriptionFr: "Coupe et brushing.", descriptionEn: null, includedFr: ["Consultation", "Brushing"], includedEn: [], priceVaries: false }],
  windows: [{ weekday: 2, startsAt: "10:00", endsAt: "18:00" }],
  daysOff: [],
  rules: { cancellationHours: 48, bookingHorizonDays: 30 },
  media: { cover: null, gallery: [] },
  team: [],
  popularServiceId: null,
  languages: { source: "fr", enabled: ["fr", "en", "es"] },
  translations: [],
  ...over,
});
const tr = (key: string, locale: "en" | "es", text: string, status: "auto" | "edited" = "auto") => ({ key, locale, text, status, runId: "run-1", sourceHash: "h" });
const view = (p: PublicShop, content: "fr" | "en" | "es") => buildStorefront({ page: p, locale: content === "es" ? "en" : content, contentLocale: content, now: NOW });

describe("the shop page in the languages the owner offers (#258)", () => {
  it("speaks the source language from the owner's own words", () => {
    const v = view(page(), "fr");
    expect(v.tagline).toBe("Coiffure de quartier");
    expect(v.services[0]).toMatchObject({ name: "Coupe", description: "Coupe et brushing.", included: ["Consultation", "Brushing"] });
  });

  it("shows a translation (automatic or edited) in a language the owner did not write", () => {
    const p = page({ translations: [tr("shop:shop-1:tagline", "es", "Peluquería de barrio"), tr("shop:shop-1:bio", "es", "Julie le recibe.", "edited"), tr("service:cut:description", "es", "Corte y peinado."), tr("service:cut:included", "es", "Consulta\nPeinado")] });
    const v = view(p, "es");
    expect(v.tagline).toBe("Peluquería de barrio");
    expect(v.about?.text).toBe("Julie le recibe.");
    expect(v.services[0]).toMatchObject({ name: "Coupe" /* no Spanish name yet: the source language */, description: "Corte y peinado.", included: ["Consulta", "Peinado"] });
  });

  it("falls back to the source language for a text that is not translated yet", () => {
    const v = view(page({ translations: [] }), "es");
    expect(v.tagline).toBe("Coiffure de quartier");
    expect(v.services[0]!.description).toBe("Coupe et brushing.");
  });

  it("what the owner wrote by hand in English wins over any translation of it", () => {
    const p = page({ translations: [tr("shop:shop-1:tagline", "en", "Machine version")] });
    p.shop.taglineEn = "Neighbourhood hair";
    expect(view(p, "en").tagline).toBe("Neighbourhood hair");
  });

  it("an English page with no English text yet says the source, never nothing", () => {
    expect(view(page(), "en").tagline).toBe("Coiffure de quartier");
  });

  it("keeps the product's own words in English on a Spanish page, and the page's links in English", () => {
    const v = view(page(), "es");
    expect(v.bookHref).toMatch(/^\/en\/s\/salon-laurier/);
  });
});

describe("what the public page never carries (#265)", () => {
  it("the street address and the legal name are not in the view of a page", () => {
    const p = page();
    (p.shop as Record<string, unknown>).address = "1234 rue Secrète";
    (p.shop as Record<string, unknown>).legalName = "Salon Laurier inc.";
    const json = JSON.stringify(view(p, "fr"));
    expect(json).not.toContain("1234 rue Secrète");
    expect(json).not.toContain("Salon Laurier inc.");
  });
});

describe("the proposed images fill only what the owner left empty (#267)", () => {
  const defaults = {
    cover: { id: "pets-cover-1", altKey: "defaultMedia.pets.cover.1", poster: "https://cdn.test/p.webp", webm: "https://cdn.test/l.webm", mp4: "https://cdn.test/l.mp4" },
    gallery: [1, 2].map((n) => ({ id: `pets-gallery-${n}`, altKey: `defaultMedia.pets.gallery.${n}`, src: `https://cdn.test/g${n}.webp`, sources: [], width: 960, height: 720 })),
    service: [1, 2, 3].map((n) => ({ id: `pets-service-${n}`, altKey: `defaultMedia.pets.service.${n}`, src: `https://cdn.test/s${n}.webp`, sources: [], width: 960, height: 640 })),
  };
  const build = (p: PublicShop) => buildStorefront({ page: p, locale: "fr", now: NOW, defaults });

  it("a shop with no media shows the cover with its loop, the photos and an image per service, described in the page's language", () => {
    const v = build(page());
    expect(v.cover).toMatchObject({ src: "https://cdn.test/p.webp", video: { webm: "https://cdn.test/l.webm", mp4: "https://cdn.test/l.mp4" } });
    expect(v.cover!.alt).toBe(fr.console.defaultMedia.pets.cover[1]);
    expect(v.gallery.map((g) => g.id)).toEqual(["pets-gallery-1", "pets-gallery-2"]);
    expect(v.galleryIllustrative).toBe(true);
    expect(v.services[0]!.image).toMatchObject({ id: "pets-service-1", alt: fr.console.defaultMedia.pets.service[1] });
  });

  it("the owner's own cover and photos are never replaced", () => {
    const p = page();
    p.media = { cover: { id: "m0", url: "https://own/c.jpg", webmUrl: null, mp4Url: null, altFr: "Ma couverture", altEn: "My cover", captionFr: null, captionEn: null, wide: true }, gallery: [{ id: "m1", url: "https://own/g.jpg", webmUrl: null, mp4Url: null, altFr: "Ma photo", altEn: "My photo", captionFr: null, captionEn: null, wide: false }] };
    const v = build(p);
    expect(v.cover!.src).toBe("https://own/c.jpg");
    expect(v.gallery.map((g) => g.id)).toEqual(["m1"]);
    expect(v.galleryIllustrative).toBe(false);
  });

  it("without defaults (switched off by the owner or the administrator) nothing is added: today's page", () => {
    const v = buildStorefront({ page: page(), locale: "fr", now: NOW });
    expect(v.cover).toBeNull();
    expect(v.gallery).toEqual([]);
    expect(v.galleryIllustrative).toBe(false);
    expect(v.services[0]!.image).toBeNull();
  });

  it("service images cycle through the three of the trade", () => {
    const p = page();
    p.services = [1, 2, 3, 4].map((n) => ({ ...p.services[0]!, id: `s${n}` }));
    expect(build(p).services.map((s) => s.image!.id)).toEqual(["pets-service-1", "pets-service-2", "pets-service-3", "pets-service-1"]);
  });
});

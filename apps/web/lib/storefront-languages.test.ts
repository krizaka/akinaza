import type { PublicShop } from "@akinaza/db";
import { describe, expect, it } from "vitest";

import { buildStorefront } from "./storefront";

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

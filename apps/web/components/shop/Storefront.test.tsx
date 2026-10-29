import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { type PublicShop, type ShopPageConfig } from "@akinaza/db";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { buildStorefront } from "@/lib/storefront";

import { Storefront } from "./test-storefront";

const TZ = "America/Toronto";
const NOW = new Date("2026-10-19T10:30:00-04:00"); // Monday, 10:30 in Montréal

/** A hair salon: the page must be made of the salon's data — no dog walker's words, no map, no gallery, no bio. */
const salon: PublicShop = {
  shop: { id: "s", name: "Salon Laurier", slug: "salon-laurier", timezone: TZ, registrant: true, taglineFr: null, taglineEn: "Cuts and colour, by appointment.", area: null, bioFr: null, bioEn: null, publicPhone: null, publicEmail: null, seatUnitFr: null, seatUnitEn: null, businessType: "professional", ownerName: "Julie" },
  zones: [],
  services: [
    { id: "cut", nameFr: "Coupe", nameEn: "Haircut", durationMinutes: 45, priceCents: 4_500, capacity: 1, descriptionFr: null, descriptionEn: "A cut and a blow-dry.", includedFr: [], includedEn: ["Shampoo"], priceVaries: false },
    { id: "colour", nameFr: "Coloration", nameEn: "Colour", durationMinutes: 90, priceCents: 9_500, capacity: 1, descriptionFr: null, descriptionEn: null, includedFr: [], includedEn: [], priceVaries: true },
  ],
  windows: [2, 3, 4, 5, 6].map((weekday) => ({ weekday, startsAt: "10:00", endsAt: "18:00" })),
  daysOff: [],
  rules: { cancellationHours: 48, bookingHorizonDays: 30 },
  media: { cover: null, gallery: [] },
  team: [],
  popularServiceId: null,
  languages: { source: "fr", enabled: ["fr", "en"] },
  translations: [],
};

/** A dog walker with everything filled in. */
const walker: PublicShop = {
  shop: { id: "w", name: "Pattes de Saint-Henri", slug: "pattes", timezone: TZ, registrant: true, taglineFr: "Des promenades de quartier.", taglineEn: "Neighbourhood dog walks.", area: "Saint-Henri, Montréal", bioFr: "Je m'appelle Léa.", bioEn: "I'm Léa.", publicPhone: "514-555-0100", publicEmail: "bonjour@pattes.example", seatUnitFr: "chiens", seatUnitEn: "dogs", businessType: "pets", ownerName: "Léa" },
  zones: [{ id: "z1", name: "Saint-Henri", lat: 45.4786, lng: -73.5878 }, { id: "z2", name: "Griffintown", lat: 45.4935, lng: -73.561 }],
  services: [
    { id: "solo", nameFr: "Promenade solo 30 min", nameEn: "Solo walk 30 min", durationMinutes: 30, priceCents: 2_200, capacity: 1, descriptionFr: "Un chien, une marcheuse.", descriptionEn: "One dog.", includedFr: ["Eau fraîche"], includedEn: [], priceVaries: false },
    { id: "group", nameFr: "Promenade en groupe 60 min", nameEn: "Group walk 60 min", durationMinutes: 60, priceCents: 2_200, capacity: 5, descriptionFr: null, descriptionEn: null, includedFr: [], includedEn: [], priceVaries: false },
  ],
  windows: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startsAt: "08:00", endsAt: "17:00" })),
  daysOff: [],
  rules: { cancellationHours: 24, bookingHorizonDays: 60 },
  media: {
    cover: { id: "c", url: "https://cdn.test/cover.webp", webmUrl: null, mp4Url: null, altFr: "Montréal en automne.", altEn: "Autumn.", captionFr: null, captionEn: null, wide: true },
    gallery: [{ id: "g", url: "https://cdn.test/g.jpg", webmUrl: null, mp4Url: null, altFr: "Le rapport.", altEn: "The report.", captionFr: "Après la sortie", captionEn: "After", wide: false }],
  },
  team: [],
  popularServiceId: "group",
  languages: { source: "fr", enabled: ["fr", "en"] },
  translations: [],
};

const render = (page: PublicShop, locale: "fr" | "en") => {
  return renderToStaticMarkup(<Storefront locale={locale} view={buildStorefront({ page, locale, now: NOW })} />);
};

describe("the storefront renders from the shop's data — a hair salon", () => {
  const html = render(salon, "en");
  it("shows its name as the h1, its promise, its services as cards with duration, price and inclusions", () => {
    expect(html).toContain("<h1");
    expect(html).toContain("Salon Laurier");
    expect(html).toContain("Cuts and colour, by appointment.");
    expect(html).toContain("Haircut");
    expect(html).toContain("A cut and a blow-dry.");
    expect(html).toContain("$45.00");
    expect(html).toContain("45 min");
    expect(html).toContain("Shampoo");
  });
  it("says « From » on the colour, whose price varies, and no Popular tag", () => {
    expect(html).toContain("From");
    expect(html).not.toContain("Popular");
  });
  it("says it is closed on a Monday and when it opens, and lists the week in a disclosure", () => {
    expect(html).toContain("Closed");
    expect(html).toContain("opens tomorrow at 10 am");
    expect(html).toContain("<details");
    expect(html).toContain("Tuesday");
  });
  it("opens each service on its own page (the times come one step later)", () => {
    expect(html).toContain('href="/en/s/salon-laurier/service/cut"');
    expect(html).not.toContain("#reserver");
  });
  it("leaves out what the salon does not have: no map, no areas, no gallery, no bio, no contact — and no dog walker's word", () => {
    expect(html).not.toContain('id="s_zones"');
    expect(html).not.toContain('id="s_gallery"');
    expect(html).not.toContain("Who you will meet");
    expect(html).not.toContain("tel:");
    expect(html.toLowerCase()).not.toMatch(/\bdogs?\b|chien|walk|promenade/);
  });
  it("states the salon's own rules and keeps the sticky action for a phone", () => {
    expect(html).toContain("Free until 48 h before the visit.");
    expect(html).toContain("Up to 30 days ahead.");
    expect(html).toContain("sticky bottom-0");
  });
});

describe("the storefront renders from the shop's data — a dog walker, in French", () => {
  const html = render(walker, "fr");
  it("uses its cover, its locality, its areas on a map, its bio and its phone", () => {
    expect(html).toContain("https://cdn.test/cover.webp");
    expect(html).toContain("Saint-Henri, Montréal");
    expect(html).toContain('id="s_zones"');
    expect(html).toContain("Carte des secteurs desservis");
    expect(html).toContain("Je m&#x27;appelle Léa.");
    expect(html).toContain('href="tel:+15145550100"');
  });

  describe("configured shop page sections", () => {
    it("uses the owner's order and hides owner-disabled or administrator-disabled sections", () => {
      const page = {
        ...walker,
        pageConfig: {
          sections: [
            { id: "wall", visible: true },
            { id: "gallery", visible: true },
            { id: "services", visible: false },
            { id: "team", visible: true },
            { id: "hours", visible: true },
            { id: "zones", visible: true },
            { id: "reels", visible: true },
            { id: "announcements", visible: true },
            { id: "reviews", visible: true },
            { id: "follow", visible: true },
          ] satisfies ShopPageConfig["sections"],
          logoUrl: "https://cdn.test/brand/logo.webp",
        },
      };
      const view = buildStorefront({ page, locale: "en", now: NOW, enabledUpcomingSections: { wall: true } });
      const html = renderToStaticMarkup(<Storefront locale="en" view={view} />);
      expect(html).not.toContain('id="s_wall"');
      expect(html).toContain("https://cdn.test/brand/logo.webp");
      expect(html).not.toContain('id="s_services"');
      expect(html).not.toContain('id="s_reels"');
      expect(html).not.toContain("This section is being prepared.");
    });
  });
  it("tags the popular service, names the capacity in the shop's unit, and says it is open now", () => {
    expect(html).toContain("Populaire");
    expect(html).toContain("Jusqu&#x27;à 5 chiens");
    expect(html).toContain("Ouvert maintenant");
  });
  it("opens the service's page with the area kept in the address", () => {
    expect(html).toContain("/fr/s/pattes/service/group?zone=z1");
  });
  it("has its gallery", () => {
    expect(html).toContain('id="s_gallery"');
    expect(html).toContain("Après la sortie");
  });
});

describe("the trade's proposed pictures on the public page (#267)", () => {
  const defaults = {
    cover: null,
    gallery: [1, 2].map((n) => ({ id: `salon-gallery-${n}`, altKey: `defaultMedia.salon.gallery.${n}`, src: `https://cdn.test/g${n}.webp`, sources: [], width: 960, height: 720 })),
    service: [],
  };

  it("are headed as pictures of the trade with a note, never as « Photos de {shop} »", () => {
    const html = renderToStaticMarkup(<Storefront locale="fr" view={buildStorefront({ page: salon, locale: "fr", now: NOW, defaults })} />);
    expect(html).toContain("Images du métier");
    expect(html).toContain("Images d&#x27;illustration, pas celles de cette boutique");
    expect(html).not.toContain("Photos de Salon Laurier");
    expect(html).toContain("https://cdn.test/g1.webp");
  });

  it("the shop's own photos keep their heading", () => {
    const html = renderToStaticMarkup(<Storefront locale="fr" view={buildStorefront({ page: walker, locale: "fr", now: NOW, defaults })} />);
    expect(html).toContain("Photos de Pattes de Saint-Henri");
    expect(html).not.toContain("Images du métier");
  });
});

// akinaza#567: the « Open now » chip was green on the dark photo in the light theme, unreadable. The guard has two halves: the facts of a hero wear the
// `scrim` tone (never a theme-tinted one), and that tone reads at 4.5:1 (WCAG AA, small text) over the WORST photo, a white one, in both themes.
const tokens = readFileSync(createRequire(import.meta.url).resolve("@krizaka/tokens/tokens.css"), "utf8");
const luminance = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

describe("the facts of a hero, drawn over the shop's photo (akinaza#567)", () => {
  it.each(["en", "fr"] as const)("wear the scrim tone, not a tinted one (%s)", (locale) => {
    const html = renderToStaticMarkup(<Storefront locale={locale} view={buildStorefront({ page: walker, locale, now: NOW })} />);
    const hero = html.slice(0, html.indexOf("</section>")); // the facts are the badges of the first section
    const tones = [...hero.matchAll(/data-tone="([a-z]+)"/g)].map((m) => m[1]);
    expect(tones.length).toBeGreaterThan(0);
    expect(new Set(tones)).toEqual(new Set(["scrim"]));
  });

  it("the scrim keeps white text at 4.5:1 over a white photo, in the light and the dark theme alike", () => {
    const alpha = Number(/--kz-scrim:\s*hsl\(0 0% 0% \/ ([\d.]+)\)/.exec(tokens)?.[1]);
    const text = /--kz-text-on-media:\s*hsl\(0 0% 100%\)/.test(tokens);
    expect(alpha).toBeGreaterThan(0);
    expect(text, "the text on media is white").toBe(true);
    const worstBackdrop = 1 - alpha; // black at `alpha` over white: the lightest the veil can come out
    expect(ratio(1, luminance(worstBackdrop))).toBeGreaterThanOrEqual(4.5);
  });
});

import type { PublicShop } from "@akinaza/db";
import { describe, expect, it } from "vitest";

import { buildStorefront, resolveSelection } from "./storefront";

const TZ = "America/Toronto";
const at = (local: string) => new Date(`${local}:00-04:00`); // EDT, until 2026-11-01
const MONDAY_1030 = at("2026-10-19T10:30");

/** French typography keeps a hair space before « h » and « $ »: the expected strings are written with plain spaces. */
const nb = (s: string) => s.replace(/(\d) ([h$])/g, "$1\u00a0$2");

const week = (weekdays: number[], startsAt: string, endsAt: string) => weekdays.map((weekday) => ({ weekday, startsAt, endsAt }));

/** The dog walker: zones with coordinates, a group service with a unit, a popular service, a cover and a gallery. */
const walker: PublicShop = {
  shop: { id: "shop-w", name: "Pattes de Saint-Henri", slug: "pattes", timezone: TZ, registrant: true, taglineFr: "Des promenades de quartier.", taglineEn: "Neighbourhood dog walks.", area: "Saint-Henri, Montréal", bioFr: "Je m'appelle Léa.", bioEn: "I'm Léa.", publicPhone: "514-555-0100", publicEmail: "bonjour@pattes.example", seatUnitFr: "chiens", seatUnitEn: "dogs", businessType: "pets", ownerName: "Léa" },
  zones: [
    { id: "z1", name: "Saint-Henri", lat: 45.4786, lng: -73.5878 },
    { id: "z2", name: "Griffintown", lat: 45.4935, lng: -73.561 },
  ],
  services: [
    { id: "s-solo", nameFr: "Promenade solo 30 min", nameEn: "Solo walk 30 min", durationMinutes: 30, priceCents: 2_200, capacity: 1, descriptionFr: "Un chien, une marcheuse.", descriptionEn: "One dog, one walker.", includedFr: ["Eau fraîche"], includedEn: ["Fresh water"], priceVaries: false },
    { id: "s-group", nameFr: "Promenade en groupe 60 min", nameEn: "Group walk 60 min", durationMinutes: 60, priceCents: 2_200, capacity: 5, descriptionFr: null, descriptionEn: null, includedFr: [], includedEn: [], priceVaries: true },
  ],
  windows: [...week([1, 2, 3, 4, 5], "08:00", "12:00"), ...week([1, 2, 3, 4, 5], "13:00", "17:00"), ...week([6], "09:00", "12:00")],
  daysOff: [],
  rules: { cancellationHours: 24, bookingHorizonDays: 60 },
  media: {
    cover: { id: "m0", url: "https://cdn.test/cover.webp", webmUrl: null, mp4Url: null, altFr: "Montréal en automne.", altEn: "Montréal in autumn.", captionFr: null, captionEn: null, wide: true },
    gallery: [{ id: "m1", url: "https://cdn.test/g1.jpg", webmUrl: "https://cdn.test/g1.webm", mp4Url: "https://cdn.test/g1.mp4", altFr: "Le rapport.", altEn: "The report.", captionFr: "Après la sortie", captionEn: "After the walk", wide: false }],
  },
  team: [],
  popularServiceId: "s-group",
  languages: { source: "fr", enabled: ["fr", "en"] },
  translations: [],
};

/** A hair salon — not a dog walker: no zones, no media, no bio, no unit, nothing popular, Tuesday to Saturday. */
const salon: PublicShop = {
  shop: { id: "shop-s", name: "Salon Laurier", slug: "salon-laurier", timezone: TZ, registrant: true, taglineFr: null, taglineEn: "Cuts and colour, by appointment.", area: null, bioFr: null, bioEn: null, publicPhone: null, publicEmail: null, seatUnitFr: null, seatUnitEn: null, businessType: "professional", ownerName: "Julie" },
  zones: [],
  services: [
    { id: "cut", nameFr: "Coupe", nameEn: "Haircut", durationMinutes: 45, priceCents: 4_500, capacity: 1, descriptionFr: null, descriptionEn: "A cut and a blow-dry.", includedFr: [], includedEn: [], priceVaries: false },
    { id: "colour", nameFr: "Coloration", nameEn: "Colour", durationMinutes: 90, priceCents: 9_500, capacity: 1, descriptionFr: null, descriptionEn: null, includedFr: [], includedEn: ["Consultation"], priceVaries: true },
  ],
  windows: week([2, 3, 4, 5, 6], "10:00", "18:00"),
  daysOff: [],
  rules: { cancellationHours: 48, bookingHorizonDays: 30 },
  media: { cover: null, gallery: [] },
  team: [],
  popularServiceId: null,
  languages: { source: "fr", enabled: ["fr", "en"] },
  translations: [],
};


describe("resolveSelection — which service and zone the page shows slots for", () => {
  it("takes the service and zone of the address when the shop offers them", () => {
    expect(resolveSelection(walker, { service: "s-solo", zone: "z2" })).toEqual({ serviceId: "s-solo", zoneId: "z2" });
  });
  it("falls back to the popular service, then to the first, and to the first zone — or none", () => {
    expect(resolveSelection(walker, {})).toEqual({ serviceId: "s-group", zoneId: "z1" });
    expect(resolveSelection(walker, { service: "nope", zone: "elsewhere" })).toEqual({ serviceId: "s-group", zoneId: "z1" });
    expect(resolveSelection(salon, {})).toEqual({ serviceId: "cut", zoneId: null });
  });
});

describe("buildStorefront — a dog walker", () => {
  const view = (locale: "fr" | "en" = "fr") => buildStorefront({ page: walker, locale, now: MONDAY_1030 });

  it("shows the hero from the shop's cover, name, promise, locality and the open-now status computed from the hours", () => {
    const v = view();
    expect(v.name).toBe("Pattes de Saint-Henri");
    expect(v.area).toBe("Saint-Henri, Montréal");
    expect(v.tagline).toBe("Des promenades de quartier.");
    expect(v.cover).toEqual({ src: "https://cdn.test/cover.webp", alt: "Montréal en automne." });
    expect(v.status).toEqual({ open: true, label: "Ouvert maintenant", detail: nb("ferme à 12 h") });
    expect(v.bookHref).toBe("/fr/s/pattes/service/s-group?zone=z1");
  });

  it("honours owner order and visibility while global feature switches remain authoritative", () => {
    const sections = [
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
    ] as const;
    const page = { ...walker, pageConfig: { sections: [...sections], logoUrl: "https://cdn.example/brand/logo.webp" } };
    const result = buildStorefront({ page, locale: "en", now: MONDAY_1030, enabledUpcomingSections: { wall: true } });
    expect(result.sections.map(({ id, visible }) => [id, visible])).toEqual([
      ["wall", true], ["gallery", true], ["services", false], ["team", true], ["hours", true], ["zones", true],
      ["reels", false], ["announcements", false], ["reviews", false], ["follow", false],
    ]);
    expect(result.logoUrl).toBe("https://cdn.example/brand/logo.webp");
  });

  it("says when it opens next while closed, in the shop's own time", () => {
    const evening = buildStorefront({ page: walker, locale: "fr", now: at("2026-10-19T18:00") });
    expect(evening.status).toEqual({ open: false, label: "Fermé", detail: nb("ouvre demain à 8 h") });
    const lunch = buildStorefront({ page: walker, locale: "en", now: at("2026-10-19T12:30") });
    expect(lunch.status).toEqual({ open: false, label: "Closed", detail: "opens at 1 pm" });
  });

  it("makes a card of each service: duration, capacity in the shop's unit, formatted price, « from », inclusions, Popular from real data", () => {
    const [solo, group] = view().services;
    expect(solo).toMatchObject({ id: "s-solo", name: "Promenade solo 30 min", duration: "30 min", capacity: null, price: nb("22,00 $"), priceFrom: null, tag: null, included: ["Eau fraîche"], description: "Un chien, une marcheuse." });
    expect(group).toMatchObject({ id: "s-group", capacity: "Jusqu'à 5 chiens", priceFrom: "À partir de", tag: "Populaire", description: null });
    expect(group!.href).toBe("/fr/s/pattes/service/s-group?zone=z1");
    expect(buildStorefront({ page: walker, locale: "en", now: MONDAY_1030 }).services[1]).toMatchObject({ capacity: "Up to 5 dogs", priceFrom: "From", tag: "Popular", price: "$22.00" });
  });

  it("puts every served area on the map and lists them as chips", () => {
    const v = view();
    expect(v.zones.map((z) => z.name)).toEqual(["Saint-Henri", "Griffintown"]);
    expect(v.map!.places).toEqual([{ id: "z1", name: "Saint-Henri", position: [-73.5878, 45.4786] }, { id: "z2", name: "Griffintown", position: [-73.561, 45.4935] }]);
    expect(v.map!.center[0]).toBeCloseTo(-73.5744, 3);
    expect(v.map!.center[1]).toBeCloseTo(45.48605, 3);
  });

  it("compacts the week into one row per day with today marked, closed days said", () => {
    const h = view().hours;
    expect(h.today).toBe("1");
    expect(h.days.map((d) => d.label)).toEqual(["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]);
    expect(h.days[0]!.hours).toBe(nb("8 h – 12 h, 13 h – 17 h"));
    expect(h.days[5]!.hours).toBe(nb("9 h – 12 h"));
    expect(h.days[6]!.hours).toBe("Fermé");
  });

  it("lists the policies, the owner's bio and contact, and the gallery with the loop", () => {
    const v = view();
    expect(v.policies).toEqual([
      { id: "cancellation", term: "Annulation", value: "Gratuite jusqu'à 24 h avant la visite." },
      { id: "taxes", term: "Prix", value: "Affichés avant taxes." },
      { id: "horizon", term: "Réservation", value: "Jusqu'à 60 jours à l'avance." },
    ]);
    expect(v.about).toEqual({ name: "Léa", text: "Je m'appelle Léa." });
    expect(v.contact).toEqual({ phone: "514-555-0100", phoneHref: "tel:+15145550100", email: "bonjour@pattes.example" });
    expect(v.gallery).toEqual([{ id: "m1", src: "https://cdn.test/g1.jpg", alt: "Le rapport.", caption: "Après la sortie", shape: "portrait", video: { webm: "https://cdn.test/g1.webm", mp4: "https://cdn.test/g1.mp4" } }]);
  });
});

describe("buildStorefront — a hair salon: the sections come from the data, not from the dog walker", () => {
  const v = buildStorefront({ page: salon, locale: "en", now: MONDAY_1030 });

  it("has no cover, no map, no area chips, no bio, no contact, no gallery — and no word of dogs", () => {
    expect(v.cover).toBeNull();
    expect(v.map).toBeNull();
    expect(v.zones).toEqual([]);
    expect(v.about).toBeNull();
    expect(v.contact).toBeNull();
    expect(v.gallery).toEqual([]);
    expect(JSON.stringify(v).toLowerCase()).not.toMatch(/dog|chien|walk|promenade/);
    expect(v.area).toBeNull();
  });

  it("sells its own services: « from » for the colour, a sentence, capacity omitted for single visits, no Popular tag", () => {
    expect(v.services.map((s) => [s.name, s.price, s.priceFrom, s.duration, s.capacity, s.tag])).toEqual([
      ["Haircut", "$45.00", null, "45 min", null, null],
      ["Colour", "$95.00", "From", "90 min", null, null],
    ]);
    expect(v.services[0]!.description).toBe("A cut and a blow-dry.");
    expect(v.services[1]!.included).toEqual(["Consultation"]);
  });

  it("is closed on Monday and says it opens tomorrow at 10 am; its week shows Monday closed", () => {
    expect(v.status).toEqual({ open: false, label: "Closed", detail: "opens tomorrow at 10 am" });
    expect(v.hours.days[0]!.hours).toBe("Closed");
    expect(v.hours.days[1]!.hours).toBe("10 am – 6 pm");
  });

  it("opens each service's own page; a shop that does not travel keeps no area in the address", () => {
    expect(v.services[0]!.href).toBe("/en/s/salon-laurier/service/cut");
    expect(v.bookHref).toBe("/en/s/salon-laurier/service/cut");
    expect(v.team).toEqual([]);
  });

  it("states the policies from the shop's own rules", () => {
    expect(v.policies[0]).toEqual({ id: "cancellation", term: "Cancellation", value: "Free until 48 h before the visit." });
    expect(v.policies[2]!.value).toBe("Up to 30 days ahead.");
  });
});

describe("buildStorefront — edge cases", () => {
  it("shows no status and no hours section for a shop without hours, and says plainly when no time is free", () => {
    const v = buildStorefront({ page: { ...salon, windows: [] }, locale: "fr", now: MONDAY_1030 });
    expect(v.status).toBeNull();
    expect(v.hours.days.every((d) => d.hours === "Fermé")).toBe(true);
  });

  it("keeps a service that is not in the address out of the selection, and builds nothing for a shop without services", () => {
    const v = buildStorefront({ page: { ...salon, services: [] }, locale: "fr", now: MONDAY_1030 });
    expect(v.services).toEqual([]);
  });
});

describe("who is here today (akinaza#209)", () => {
  const team = { ...salon, team: [{ id: "julie", name: "Julie" }, { id: "marc", name: "Marc" }, { id: "lea", name: "Léa" }] };
  const hours = week([1, 2, 3, 4, 5], "09:00", "17:00");
  const teamDay = new Map([
    ["julie", { windows: hours, visits: [{ startsAt: at("2026-10-19T10:00"), endsAt: at("2026-10-19T11:15") }], offUntil: null }],
    ["marc", { windows: hours, visits: [], offUntil: null }],
    ["lea", { windows: hours, visits: [], offUntil: "2026-10-27" }],
  ]);

  it("each first name has one state, in the page's language", () => {
    const fr = buildStorefront({ page: team, locale: "fr", now: MONDAY_1030, teamDay }).team;
    const plain = (text: string | null) => (text ?? "").replace(/\u00a0/g, " ");
    expect(fr.map((m) => [m.name, plain(m.state), m.free])).toEqual([
      ["Julie", "Occupé·e jusqu'à 11 h 15", false],
      ["Marc", "Libre maintenant", true],
      ["Léa", "En congé jusqu'au 27 octobre", false],
    ]);
    expect(buildStorefront({ page: team, locale: "en", now: MONDAY_1030, teamDay }).team[1]!.state).toBe("Free now");
  });

  it("the page receives a name and a state, nothing else — no visit, no reason", () => {
    for (const m of buildStorefront({ page: team, locale: "fr", now: MONDAY_1030, teamDay }).team) expect(Object.keys(m).sort()).toEqual(["free", "id", "name", "state"]);
    expect(buildStorefront({ page: team, locale: "fr", now: MONDAY_1030 }).team[0]!.state).toBeNull();
  });
});

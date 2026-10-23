import type { BusinessType } from "@akinaza/core";
import { defaultShopPageConfig } from "@akinaza/db";
import { describe, expect, it, vi } from "vitest";

import { renderIn } from "@/lib/test-i18n";

import { BookingFlow } from "./BookingFlow";
import { ClientFilePanel } from "./ClientFilePanel";
import { type ClientFileView,ClientHome } from "./ClientHome";
import { ShopSession } from "./ShopSession";
import { ShopSetupView } from "./ShopSetup";
import { WalkerDay } from "./WalkerDay";

vi.mock("@/app/actions/remember-shop", () => ({ rememberShop: () => Promise.resolve() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, replace: () => undefined, push: () => undefined }), usePathname: () => "/en/app" }));

const DOG_WORDS = { en: /\b(walks?|walkers?|dogs?|pups?|pets?|leash|breed|vet)\b|Saint-Henri/i, fr: /promenad|chiens?\b|chiot|\ben laisse\b|animal|animaux|vétérin|\brace\b|Saint-Henri/i };

const around = renderIn;
/** What a reader sees: the text of the markup, without tags. */
const readable = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");

const visit = {
  appointmentId: "a1",
  startsAt: "2026-10-20T13:00:00Z",
  endsAt: "2026-10-20T14:00:00Z",
  status: "done" as const,
  service: { fr: "Développement (à l'heure)", en: "Development (hourly)", capacity: 1 },
  zone: null,
  checkedInAt: "2026-10-20T13:00:00Z",
  checkedOutAt: "2026-10-20T14:00:00Z",
  minutes: 60,
  bookings: [{ bookingId: "b1", clientId: "c1", clientName: "Café du Parc inc.", clientPhone: "514-555-0111", dependant: { name: "Café du Parc inc.", kind: "other" as const, profile: {} }, hasAccessNotes: false, report: null }],
};
const nav = { prev: "/en/app?day=2026-10-19", next: "/en/app?day=2026-10-21", today: "/en/app", isToday: true };

describe.each(["en", "fr"] as const)("a studio's screens, %s", (locale) => {
  it("the day reads as appointments, with no dog, no report and no access notes", () => {
    const text = readable(around(locale, "professional", <WalkerDay visits={[visit]} timeZone="America/Toronto" nav={nav} />));
    expect(text).not.toMatch(DOG_WORDS[locale]);
    expect(text).toMatch(locale === "en" ? /Start the appointment|End the appointment|Client: Café du Parc/ : /Commencer le rendez-vous|Terminer le rendez-vous|Client : Café du Parc/);
  });

  it("the day of an empty studio says there is no appointment, not no walk", () => {
    const text = readable(around(locale, "professional", <WalkerDay visits={[]} timeZone="America/Toronto" nav={nav} />));
    expect(text).toMatch(locale === "en" ? /No appointment this day/ : /Aucun rendez-vous ce jour-là/);
    expect(text).not.toMatch(DOG_WORDS[locale]);
  });

  it("the booking asks for a service and a time, never for a dog", () => {
    const data = { shop: { id: "s", name: "Krizaka (démo)", slug: "krizaka-demo" }, services: [{ id: "x", nameFr: "Atelier", nameEn: "Workshop", durationMinutes: 180, priceCents: 60_000, capacity: 1 }], zones: [], client: { id: "c", fullName: "Café du Parc inc." }, dogs: [], preselect: { serviceId: null, zoneId: null, startsAt: null }, timeZone: "America/Toronto", bookingsHref: "/en/app", staffId: null };
    const text = readable(around(locale, "professional", <BookingFlow data={data} />));
    expect(text).not.toMatch(DOG_WORDS[locale]);
    expect(text).toMatch(locale === "en" ? /Book this appointment/ : /Réserver ce rendez-vous/);
  });

  it("the setup page words a studio's page and offers the business type", () => {
    const data = { page: { name: "Krizaka (démo)", legalName: "Technologies Krizaka inc. (démo)", address: "1 rue Exemple", slug: "krizaka-demo", ownerName: "Éric", taglineFr: "", taglineEn: "", published: true, area: "Montréal", bioFr: "", bioEn: "", publicPhone: "", publicEmail: "", seatUnitFr: "", seatUnitEn: "", businessType: "professional" as const }, shopId: "s", pageConfig: defaultShopPageConfig(), publicUrl: null, zones: [], services: [{ id: "x", nameFr: "Atelier", nameEn: "Workshop", durationMinutes: 180, priceCents: 60_000, capacity: 1, descriptionFr: "", descriptionEn: "", includedFr: [], includedEn: [], priceVaries: false }], media: { cover: null, gallery: [] }, windows: [], daysOff: [], rules: null, proposed: null, templates: null };
    const html = around(locale, "professional", <ShopSetupView data={data} tab="offer" />);
    // The type picker names both types, by design; everything else is the studio's.
    const text = readable(html).replace(locale === "en" ? /Pet care \(walks, grooming…\)/ : /Soins aux animaux \(promenades, toilettage…\)/, "");
    expect(text).not.toMatch(DOG_WORDS[locale]);
    expect(text).toMatch(locale === "en" ? /People per appointment/ : /Personnes par rendez-vous/);
  });

  it("a client's file shows a client, not a client's dogs", () => {
    const file = {
      client: { id: "c", fullName: "Café du Parc inc.", phone: "514-555-0111", email: "contact@example.test", language: "fr" as const, notes: null, hasAccessNotes: true, since: "2026-10-01T12:00:00.000Z" },
      dependants: [{ id: "d", name: "Café du Parc inc.", kind: "other" as const, profile: {} }],
      visits: [],
      invoices: [],
    };
    const text = readable(around(locale, "professional", <ShopSession locale="en" shopId="s1" remembered><ClientFilePanel file={file} timeZone="America/Toronto" nowIso="2026-10-22T15:00:00.000Z" /></ShopSession>));
    expect(text).toContain("Café du Parc inc.");
    expect(text).not.toMatch(DOG_WORDS[locale]);
    expect(text).not.toMatch(/Animal|Chien|Dog|Access notes|Notes d'accès/);
  });

  it("a client's space speaks each shop's own words", () => {
    const file = (shopName: string, businessType: BusinessType): ClientFileView => ({ client: { id: shopName, fullName: "Jordan", shopName, shopSlug: shopName.toLowerCase(), businessType }, dogs: businessType === "pets" ? [{ id: "d", name: "Luna", breed: null }] : [], bookings: [], requests: { clientId: shopName, shopSlug: shopName.toLowerCase(), requests: [], catalogue: null }, now: "2026-10-20T00:00:00Z", timeZone: "America/Toronto" });
    const html = around(locale, "pets", <ClientHome files={[file("Studio", "professional"), file("Pattes", "pets")]} />);
    const [studio, pattes] = html.split(/<section/).slice(1).map(readable);
    expect(studio).not.toMatch(DOG_WORDS[locale]);
    expect(pattes).toMatch(DOG_WORDS[locale]);
  });
});

describe("a pet-care shop keeps its words", () => {
  it("the client's file lists their dogs with the breed", () => {
    const file = {
      client: { id: "c", fullName: "Camille", phone: null, email: null, language: "fr" as const, notes: null, hasAccessNotes: false, since: "2026-10-01T12:00:00.000Z" },
      dependants: [{ id: "d", name: "Rex", kind: "dog" as const, profile: { breed: "Labrador", size: "large" as const } }],
      visits: [],
      invoices: [],
    };
    const text = readable(around("en", "pets", <ShopSession locale="en" shopId="s1" remembered><ClientFilePanel file={file} timeZone="America/Toronto" nowIso="2026-10-22T15:00:00.000Z" /></ShopSession>));
    expect(text).toMatch(/Rex/);
    expect(text).toMatch(/Labrador · large/);
  });

  it("the day is the walker's: walks, dogs and their owners", () => {
    const text = readable(around("en", "pets", <WalkerDay visits={[{ ...visit, bookings: [{ ...visit.bookings[0]!, clientName: "Camille", dependant: { name: "Rex", kind: "dog" as const, profile: { breed: "Labrador" } } }] }]} timeZone="America/Toronto" nav={nav} />));
    expect(text).toMatch(/Rex/);
    expect(text).toMatch(/Owner: Camille/);
    expect(text).toMatch(/1 dogs|1 dog/);
    expect(text).toMatch(/Report for Rex/);
  });
});

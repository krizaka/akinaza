import type { BookingDetail, PublicShop, StaffSlot } from "@akinaza/db";
import { describe, expect, it } from "vitest";

import { canCancel } from "@akinaza/core";
import { cancellationRule, confirmationStep, guestStep, serviceStep, timesHref, timesStep } from "./journey";

const TZ = "America/Toronto";
const NOW = new Date("2026-10-19T12:00:00Z");
const page = {
  shop: { id: "s", name: "Salon Cèdre & Ciseaux", slug: "cedre-ciseaux", timezone: TZ, registrant: true, taglineFr: null, taglineEn: null, area: null, bioFr: null, bioEn: null, publicPhone: "514-555-0110", publicEmail: null, seatUnitFr: null, seatUnitEn: null, businessType: "professional", ownerName: "Maëlle" },
  zones: [],
  services: [
    { id: "cut", nameFr: "Coupe", nameEn: "Cut", durationMinutes: 60, priceCents: 7_500, capacity: 1, descriptionFr: "Une coupe.", descriptionEn: "A cut.", includedFr: ["Lavage"], includedEn: ["Wash"], priceVaries: false },
    { id: "colour", nameFr: "Couleur", nameEn: "Colour", durationMinutes: 150, priceCents: 16_000, capacity: 1, descriptionFr: null, descriptionEn: null, includedFr: [], includedEn: [], priceVaries: true },
    { id: "talk", nameFr: "Consultation", nameEn: "Consultation", durationMinutes: 20, priceCents: 0, capacity: 1, descriptionFr: null, descriptionEn: null, includedFr: [], includedEn: [], priceVaries: false },
  ],
  windows: [],
  team: [{ id: "m", name: "Maëlle" }, { id: "k", name: "Karim" }],
  daysOff: [],
  rules: { cancellationHours: 24, bookingHorizonDays: 60 },
  media: { cover: null, gallery: [] },
  popularServiceId: null,
} as unknown as PublicShop;
const solo = { ...page, team: [{ id: "m", name: "Maëlle" }] } as PublicShop;

describe("a service step", () => {
  it("shows the duration, the price and the tax to the cent, in French", () => {
    const s = serviceStep({ page, locale: "fr", serviceId: "cut", staffId: null })!;
    expect(s.name).toBe("Coupe");
    expect(s.duration).toBe("60 min");
    expect(s.price.replace(/\s/g, " ")).toBe("75,00 $");
    // 75,00 $ + TPS 3,75 $ + TVQ 7,48 $ (9,975 % de 75 = 7,48125) = 86,23 $
    expect(s.taxLine?.replace(/\s/g, " ")).toBe("75,00 $ + TPS 3,75 $ + TVQ 7,48 $ = 86,23 $");
    expect(s.cancelRule).toContain("24 h");
    expect(s.included).toEqual(["Lavage"]);
  });
  it("says « from » when the price varies, and « free » with no tax line when it is free", () => {
    expect(serviceStep({ page, locale: "en", serviceId: "colour", staffId: null })!.price).toBe("From $160.00");
    const free = serviceStep({ page, locale: "en", serviceId: "talk", staffId: null })!;
    expect(free.price).toBe("Free");
    expect(free.taxLine).toBeNull();
  });
  it("shows no tax line for a shop that is not registered", () => {
    const small = { ...page, shop: { ...page.shop, registrant: false } } as PublicShop;
    expect(serviceStep({ page: small, locale: "en", serviceId: "cut", staffId: null })!.taxLine).toBeNull();
  });
  it("offers a choice of person only when several work here, « anyone » first, the chosen one marked", () => {
    const s = serviceStep({ page, locale: "en", serviceId: "cut", staffId: "k" })!;
    expect(s.team.map((m) => [m.name, m.selected])).toEqual([["Anyone free", false], ["Maëlle", false], ["Karim", true]]);
    expect(s.timesHref).toBe("/en/s/cedre-ciseaux/service/cut/slots?staff=k");
    expect(s.zones).toEqual([]);
    expect(serviceStep({ page: solo, locale: "en", serviceId: "cut", staffId: null })!.team).toEqual([]);
  });
  it("a shop that goes to its clients offers its areas, kept in the address", () => {
    const walker = { ...solo, zones: [{ id: "z1", name: "Saint-Henri" }, { id: "z2", name: "Griffintown" }] } as unknown as PublicShop;
    const s = serviceStep({ page: walker, locale: "en", serviceId: "cut", staffId: null, zoneId: "z2" })!;
    expect(s.zones.map((z) => [z.name, z.selected])).toEqual([["Saint-Henri", false], ["Griffintown", true]]);
    expect(s.timesHref).toBe("/en/s/cedre-ciseaux/service/cut/slots?zone=z2");
    expect(serviceStep({ page: walker, locale: "en", serviceId: "cut", staffId: null })!.timesHref).toContain("zone=z1");
    const t2 = timesStep({ page: walker, locale: "en", now: NOW, serviceId: "cut", staffId: null, zoneId: "z2", slots: [{ startsAt: new Date("2026-10-20T13:00:00Z"), endsAt: new Date("2026-10-20T14:00:00Z"), seatsLeft: 1, capacity: 1, joins: false, staffId: "m" }] })!;
    expect(t2.days[0]!.slots[0]!.href).toContain("zone=z2");
  });
  it("ignores a person who is not on the team, and an unknown service is null", () => {
    expect(serviceStep({ page, locale: "en", serviceId: "cut", staffId: "stranger" })!.timesHref).toBe("/en/s/cedre-ciseaux/service/cut/slots");
    expect(serviceStep({ page, locale: "en", serviceId: "nope", staffId: null })).toBeNull();
  });
});

describe("a times step", () => {
  const slot = (iso: string, staffId = "m"): StaffSlot => ({ startsAt: new Date(iso), endsAt: new Date(iso), seatsLeft: 1, capacity: 1, joins: false, staffId });
  it("groups the free times by local day, each a link that carries the service, the person and the time", () => {
    const step = timesStep({ page, locale: "fr", now: NOW, serviceId: "cut", staffId: "m", slots: [slot("2026-10-20T13:00:00Z"), slot("2026-10-20T14:30:00Z"), slot("2026-10-21T13:00:00Z")] })!;
    expect(step.days.map((d) => d.slots.length)).toEqual([2, 1]);
    expect(step.days[0]!.label).toBe("Demain");
    expect(step.days[0]!.slots[0]!.label.replace(/\s/g, " ")).toBe("9 h");
    expect(step.days[0]!.slots[1]!.label.replace(/\s/g, " ")).toBe("10 h 30");
    expect(step.days[0]!.slots[0]!.href).toBe("/fr/s/cedre-ciseaux/service/cut/confirm?staff=m&start=2026-10-20T13%3A00%3A00.000Z");
    expect(step.who).toBe("Avec Maëlle");
  });
  it("also groups each day's times by part of the day on the shop's clock, and says which clock (SlotPicker groups, krizaka-ui#672)", () => {
    const step = timesStep({ page, locale: "en", now: NOW, serviceId: "cut", staffId: "m", slots: [slot("2026-10-20T13:00:00Z"), slot("2026-10-20T19:30:00Z"), slot("2026-10-20T23:00:00Z")] })!;
    expect(step.days[0]!.groups.map((g) => [g.id, g.label, g.slots.length])).toEqual([["morning", "Morning", 1], ["afternoon", "Afternoon", 1], ["evening", "Evening", 1]]);
    expect(step.days[0]!.groups[0]!.slots[0]!.href).toBe(step.days[0]!.slots[0]!.href);
    expect(step.footer).toBe(`Times in ${page.shop.timezone}`);
    expect(timesStep({ page, locale: "fr", now: NOW, serviceId: "cut", staffId: "m", slots: [slot("2026-10-20T13:00:00Z")] })!.days[0]!.groups[0]!.label).toBe("Matin");
  });
  it("for anyone, no person is named in the link; a lone worker is not named at all", () => {
    const labelled = timesStep({ page, locale: "en", now: NOW, serviceId: "cut", staffId: "m", slots: [slot("2026-10-20T11:59:59Z"), slot("2026-10-20T12:00:00Z"), slot("2026-10-20T12:00:01Z")] })!;
    const notes = labelled.days[0]!.slots.map((x) => x.note ?? null);
    expect(notes, "an instant inside 24 h is labelled; exactly 24 h before is still free").toEqual(["No free cancellation", null, null]);
    expect(timesStep({ page, locale: "fr", now: NOW, serviceId: "cut", staffId: "m", slots: [slot("2026-10-19T18:00:00Z")] })!.days[0]!.slots[0]!.note).toBe("Sans annulation gratuite");
    const any = timesStep({ page, locale: "en", now: NOW, serviceId: "cut", staffId: null, slots: [slot("2026-10-20T13:00:00Z")] })!;
    expect(any.days[0]!.slots[0]!.href).not.toContain("staff=");
    expect(any.who).toBe("Anyone free");
    const alone = timesStep({ page: solo, locale: "en", now: NOW, serviceId: "cut", staffId: null, slots: [] })!;
    expect(alone.who).toBeNull();
    expect(alone.changeHref).toBeNull();
    expect(alone.days).toEqual([]);
  });
  it("the way back keeps the person, and the addresses are the journey's", () => {
    expect(timesStep({ page, locale: "en", now: NOW, serviceId: "cut", staffId: "k", slots: [] })!.backHref).toBe("/en/s/cedre-ciseaux/service/cut?staff=k");
    expect(timesHref("fr", "x", "s")).toBe("/fr/s/x/service/s/slots");
  });
});

describe("the confirmation", () => {
  const detail: BookingDetail = {
    id: "b1", cancelled: false, startsAt: new Date("2026-10-27T17:00:00Z"), endsAt: new Date("2026-10-27T18:00:00Z"), timezone: TZ,
    shop: { name: "Salon Cèdre & Ciseaux", slug: "cedre-ciseaux", address: "4100 rue Notre-Dame O., Montréal QC", publicPhone: "514-555-0110", registrant: false },
    service: { id: "cut", nameFr: "Coupe", nameEn: "Cut", durationMinutes: 60, priceCents: 7_500 },
    staffName: "Karim", cancellationHours: 24, cancellable: true,
  };
  it("says when, with whom, where, how much, and gives the calendar file and the phone", () => {
    const c = confirmationStep({ detail, locale: "en" });
    expect(c.title).toBe("Cut");
    expect(c.when).toBe("Tuesday, October 27 · 1 pm");
    expect(c.who).toBe("Karim");
    expect(c.where).toContain("4100 rue Notre-Dame");
    expect(c.price).toBe("$75.00");
    expect(c.calendarHref).toBe("/api/me/bookings/b1/calendar");
    expect(c.phoneHref).toBe("tel:+15145550110");
    expect(c.cancellable).toBe(true);
  });
  it("the receipt says the price the summary said: taxes included for a registered shop, the same line", () => {
    const registered = confirmationStep({ detail: { ...detail, shop: { ...detail.shop, registrant: true } }, locale: "en" });
    const summary = guestStep({ page, locale: "en", serviceId: "cut", startsAt: detail.startsAt, now: NOW, staffId: null, zoneId: null });
    expect(registered.price).toBe(summary!.taxLine);
    expect(registered.price).toContain("86.23");
  });
  it("a cancelled or past-window booking cannot be cancelled again", () => {
    expect(confirmationStep({ detail: { ...detail, cancelled: true, cancellable: false }, locale: "fr" }).cancelled).toBe(true);
  });
});

describe("the cancellation rule, said for the visit", () => {
  const start = new Date("2026-10-27T17:00:00Z");
  const at = (offsetMinutes: number) => new Date(start.getTime() - 24 * 60 * 60_000 + offsetMinutes * 60_000);
  const detailAt = (now: Date, startsAt = start, timezone = TZ): BookingDetail => ({
    id: "b1", cancelled: false, startsAt, endsAt: new Date(startsAt.getTime() + 3_600_000), timezone,
    shop: { name: "Salon", slug: "cedre-ciseaux", address: "x", publicPhone: null, registrant: true },
    service: { id: "cut", nameFr: "Coupe", nameEn: "Cut", durationMinutes: 60, priceCents: 7_500 },
    staffName: "Karim", cancellationHours: 24, cancellable: canCancel(startsAt, now, 24),
  });
  const both = (now: Date, locale: "en" | "fr" = "en", startsAt = start, timezone = TZ) => ({
    summary: guestStep({ page, locale, serviceId: "cut", startsAt, now, staffId: null, zoneId: null })!.cancelRule,
    receipt: confirmationStep({ detail: detailAt(now, startsAt, timezone), locale }).cancelRule,
  });
  it("outside the window: free until 24 h before, and the summary and the receipt agree", () => {
    const { summary, receipt } = both(at(-1));
    expect(summary).toBe("Free cancellation until 24 h before.");
    expect(receipt).toBe(summary);
  });
  it("exactly 24 h before the visit is still free", () => {
    const { summary, receipt } = both(at(0));
    expect(summary).toBe(cancellationRule({ open: true, hours: 24, locale: "en" }));
    expect(receipt).toBe(summary);
  });
  it("inside the window (one minute past): the summary says it has passed, like the receipt", () => {
    const { summary, receipt } = both(at(1));
    expect(summary).toContain("has passed");
    expect(receipt).toBe(summary);
  });
  it("is said the same in French", () => {
    const { summary, receipt } = both(at(1), "fr");
    expect(summary).toContain("est passé");
    expect(receipt).toBe(summary);
  });
  it("does not depend on the shop's time zone: the same instant gives the same answer in Vancouver and Toronto", () => {
    for (const timezone of ["America/Toronto", "America/Vancouver", "UTC"]) {
      expect(both(at(-1), "en", start, timezone).receipt).toContain("until 24 h");
      expect(both(at(1), "en", start, timezone).receipt).toContain("has passed");
    }
  });
});

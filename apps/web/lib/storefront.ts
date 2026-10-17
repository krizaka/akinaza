import { addLocalDays, bookingPreselect, groupSlotsByDay, localDay, openStatus, type Slot, weekdayOf, weekSchedule } from "@akinaza/core";
import type { PublicMedia, PublicShop } from "@akinaza/db";

import { type Locale, translator } from "@/lib/i18n";

/**
 * A shop's public page, as the page draws it: every section is computed from the shop's data (its hours, services, zones,
 * media, rules) and the clock — nothing says « dog » unless the shop does. Pure: `now` and the shop's time zone are
 * parameters, the words come from the message catalogues, the addresses are built here (structure, not words).
 */

/** Longitude, latitude — the order MapLibre reads. */
export type LngLat = [number, number];

export interface ServiceView {
  id: string;
  name: string;
  description: string | null;
  included: string[];
  duration: string;
  /** « Up to 5 dogs »; null for a single visit. */
  capacity: string | null;
  price: string;
  /** « From », when the price varies. */
  priceFrom: string | null;
  /** « Popular » — only from real bookings. */
  tag: string | null;
  /** The booking section with this service chosen (the address says so). */
  href: string;
}

export interface SlotView {
  id: string;
  label: string;
  note?: string;
  href: string;
}

export interface DayView {
  id: string;
  label: string;
  sub: string;
  slots: SlotView[];
}

export interface StorefrontView {
  name: string;
  eyebrow: string;
  tagline: string | null;
  cover: { src: string; alt: string; video?: { webm?: string; mp4?: string } } | null;
  status: { open: boolean; label: string; detail: string } | null;
  bookHref: string;
  services: ServiceView[];
  booking: {
    services: { id: string; name: string; selected: boolean; href: string }[];
    zones: { id: string; name: string; selected: boolean; href: string }[];
    days: DayView[];
  };
  zones: { id: string; name: string }[];
  map: { center: LngLat; zoom: number; places: { id: string; name: string; position: LngLat }[] } | null;
  hours: { today: string; status: { open: boolean; label: string; detail?: string }; days: { id: string; label: string; hours: string }[] };
  policies: { id: string; term: string; value: string }[];
  about: { name: string; text: string } | null;
  contact: { phone: string | null; phoneHref: string | null; email: string | null } | null;
  gallery: { id: string; src: string; alt: string; caption?: string; shape: "portrait" | "wide"; video?: { webm?: string; mp4?: string } }[];
}

export interface Selection {
  service?: string | null;
  zone?: string | null;
}

/** The service and the zone the page shows times for: the address's when the shop offers them, else the popular service (or the first) and the first zone. */
export function resolveSelection(page: PublicShop, selection: Selection): { serviceId: string | null; zoneId: string | null } {
  const picked = bookingPreselect({ service: selection.service, zone: selection.zone }, page.services, page.zones);
  return {
    serviceId: picked.serviceId ?? (page.services.find((s) => s.id === page.popularServiceId) ?? page.services[0])?.id ?? null,
    zoneId: picked.zoneId ?? page.zones[0]?.id ?? null,
  };
}

const NBSP = " ";

/** `HH:MM` as the reader's language writes it: `13 h 30` · `1:30 pm`. */
export function clockLabel(clock: string, locale: Locale): string {
  const h = Number(clock.slice(0, 2));
  const m = clock.slice(3, 5);
  if (locale === "fr") return m === "00" ? `${h}${NBSP}h` : `${h}${NBSP}h${NBSP}${m}`;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m === "00" ? "" : `:${m}`} ${h < 12 ? "am" : "pm"}`;
}

const localClock = (instant: Date, timezone: string) => new Intl.DateTimeFormat("en-CA", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(instant);
const lang = (locale: Locale) => (locale === "fr" ? "fr-CA" : "en-CA");
const dayName = (day: string, locale: Locale, weekday: "short" | "long") => new Intl.DateTimeFormat(lang(locale), { timeZone: "UTC", weekday }).format(new Date(`${day}T12:00:00Z`));
const dayMonth = (day: string, locale: Locale) => new Intl.DateTimeFormat(lang(locale), { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${day}T12:00:00Z`));
const money = (cents: number, locale: Locale) => new Intl.NumberFormat(lang(locale), { style: "currency", currency: "CAD" }).format(cents / 100);

const telHref = (phone: string): string | null => {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `tel:+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `tel:+${digits}`;
  return digits.length >= 7 ? `tel:${digits}` : null;
};

/** The zoom that shows every place with a margin (Web Mercator: a degree of longitude is 256·2^z/360 px). */
function zoomFor(positions: readonly LngLat[]): number {
  if (positions.length < 2) return 13;
  const span = Math.max(Math.max(...positions.map((p) => p[0])) - Math.min(...positions.map((p) => p[0])), Math.max(...positions.map((p) => p[1])) - Math.min(...positions.map((p) => p[1])));
  return Math.min(14, Math.max(9, Math.round(Math.log2(360 / (span * 2.6)))));
}

const mediaView = (m: PublicMedia, locale: Locale) => {
  const video = m.webmUrl || m.mp4Url ? { ...(m.webmUrl ? { webm: m.webmUrl } : {}), ...(m.mp4Url ? { mp4: m.mp4Url } : {}) } : undefined;
  return { src: m.url, alt: locale === "fr" ? m.altFr : m.altEn, ...(video ? { video } : {}) };
};

export function buildStorefront(input: { page: PublicShop; locale: Locale; now: Date; selection: Selection; slots: readonly Slot[] }): StorefrontView {
  const { page, locale, now, slots } = input;
  const t = translator(locale);
  const timezone = page.shop.timezone;
  const base = `/${locale}/s/${page.shop.slug}`;
  const pick = (fr: string | null | undefined, en: string | null | undefined) => (locale === "fr" ? fr : en) || null;
  const { serviceId, zoneId } = resolveSelection(page, input.selection);
  const pageHref = (service: string | null, zone: string | null) => {
    const query = [service ? `service=${service}` : "", zone ? `zone=${zone}` : ""].filter(Boolean).join("&");
    return `${base}${query ? `?${query}` : ""}#reserver`;
  };

  // Open now, from the hours.
  const windows = page.windows;
  const open = windows.length ? openStatus(windows, now, timezone, page.daysOff) : null;
  const time = (clock: string) => clockLabel(clock, locale);
  let status: StorefrontView["status"] = null;
  if (open) {
    if (open.open) status = { open: true, label: t("console.shopPage.open"), detail: t("console.shopPage.closesAt", { time: time(open.closesAt!) }) };
    else {
      const next = open.nextOpen;
      const detail = !next ? "" : next.today ? t("console.shopPage.opensAt", { time: time(next.time) }) : next.tomorrow ? t("console.shopPage.opensTomorrow", { time: time(next.time) }) : t("console.shopPage.opensOn", { day: dayName(next.day, locale, "long"), time: time(next.time) });
      status = { open: false, label: t("console.shopPage.closed"), detail };
    }
  }

  // Services, as cards.
  const unit = pick(page.shop.seatUnitFr, page.shop.seatUnitEn);
  const services: ServiceView[] = page.services.map((s) => ({
    id: s.id,
    name: locale === "fr" ? s.nameFr : s.nameEn,
    description: pick(s.descriptionFr, s.descriptionEn),
    included: locale === "fr" ? s.includedFr : s.includedEn,
    duration: t("console.shopPage.minutes", { minutes: s.durationMinutes }),
    capacity: s.capacity > 1 ? (unit ? t("console.shopPage.capacityUnit", { count: s.capacity, unit }) : t("console.shopPage.capacitySeats", { count: s.capacity })) : null,
    price: money(s.priceCents, locale),
    priceFrom: s.priceVaries ? t("console.shopPage.from") : null,
    tag: s.id === page.popularServiceId ? t("console.shopPage.popular") : null,
    href: pageHref(s.id, zoneId),
  }));

  // The next free times, as chips that open the booking with everything chosen.
  const today = localDay(now, timezone);
  const tomorrow = addLocalDays(today, 1);
  const days: DayView[] = groupSlotsByDay(slots, timezone, { maxDays: 7, maxPerDay: 8 }).map((d) => ({
    id: d.day,
    label: d.day === today ? t("console.shopPage.today") : d.day === tomorrow ? t("console.shopPage.tomorrow") : dayName(d.day, locale, "short"),
    sub: dayMonth(d.day, locale),
    slots: d.slots.map((s) => ({
      id: s.startsAt.toISOString(),
      label: time(localClock(s.startsAt, timezone)),
      ...(s.joins ? { note: `${s.seatsLeft}/${s.capacity}` } : {}),
      href: `${base}/book?${[`service=${serviceId}`, zoneId ? `zone=${zoneId}` : "", `start=${encodeURIComponent(s.startsAt.toISOString())}`].filter(Boolean).join("&")}`,
    })),
  }));

  // Where: chips and a map of the places that have a position.
  const placed = page.zones.filter((z) => z.lat !== null && z.lng !== null).map((z) => ({ id: z.id, name: z.name, position: [z.lng!, z.lat!] as LngLat }));
  const map = placed.length
    ? { center: [placed.reduce((n, p) => n + p.position[0], 0) / placed.length, placed.reduce((n, p) => n + p.position[1], 0) / placed.length] as LngLat, zoom: zoomFor(placed.map((p) => p.position)), places: placed }
    : null;

  // The week, compact, today marked.
  const todayId = String(weekdayOf(today));
  const week = weekSchedule(windows).map((d) => ({
    id: String(d.weekday),
    label: t(`console.shopSetup.weekdays.${String(d.weekday) as "0"}`),
    hours: d.windows.length ? d.windows.map((w) => `${time(w.startsAt)} – ${time(w.endsAt)}`).join(", ") : t("console.shopPage.closedDay"),
  }));

  const policies = [
    { id: "cancellation", term: t("console.shopPage.policyCancellation"), value: t("console.shopPage.cancellation", { hours: page.rules.cancellationHours }) },
    { id: "taxes", term: t("console.shopPage.policyTaxes"), value: t("console.shopPage.taxes") },
    { id: "horizon", term: t("console.shopPage.policyHorizon"), value: t("console.shopPage.horizon", { days: page.rules.bookingHorizonDays }) },
  ];

  const bio = pick(page.shop.bioFr, page.shop.bioEn);
  const phone = page.shop.publicPhone;
  const email = page.shop.publicEmail;

  return {
    name: page.shop.name,
    eyebrow: page.shop.area || t("console.shopPage.by"),
    tagline: pick(page.shop.taglineFr, page.shop.taglineEn),
    cover: page.media.cover ? mediaView(page.media.cover, locale) : null,
    status,
    bookHref: `${base}/book`,
    services,
    booking: {
      services: page.services.map((s) => ({ id: s.id, name: locale === "fr" ? s.nameFr : s.nameEn, selected: s.id === serviceId, href: pageHref(s.id, zoneId) })),
      zones: page.zones.length > 1 ? page.zones.map((z) => ({ id: z.id, name: z.name, selected: z.id === zoneId, href: pageHref(serviceId, z.id) })) : [],
      days,
    },
    zones: page.zones.map((z) => ({ id: z.id, name: z.name })),
    map,
    hours: { today: todayId, status: status ?? { open: false, label: t("console.shopPage.closed") }, days: week },
    policies,
    about: bio ? { name: page.shop.ownerName, text: bio } : null,
    contact: phone || email ? { phone: phone || null, phoneHref: phone ? telHref(phone) : null, email: email || null } : null,
    gallery: page.media.gallery.map((m) => ({ id: m.id, ...mediaView(m, locale), ...(pick(m.captionFr, m.captionEn) ? { caption: pick(m.captionFr, m.captionEn)! } : {}), shape: m.wide ? ("wide" as const) : ("portrait" as const) })),
  };
}

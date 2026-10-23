import { bookingPreselect, localDay, MEMBER_STATE, type MemberDay, memberStateAt, openStatus, resolveTemplate, weekdayOf, weekSchedule } from "@akinaza/core";
import type { PublicMedia, PublicShop } from "@akinaza/db";

import type { DefaultImage, ResolvedDefaults } from "@/lib/default-media";
import { type Locale, type PageLocale, translator } from "@/lib/i18n";
import { serviceHref } from "@/lib/journey-paths";

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
  /** A proposed image for the card, from the shop type's defaults (#267); null when the page does not show them. */
  image: ServiceImage | null;
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

/** What a default image says to a screen reader, in the page's language. */
export type ServiceImage = { id: string; alt: string; src: string; sources: DefaultImage["sources"]; width: number; height: number };

export interface StorefrontView {
  name: string;
  /** The locality the shop gives (« Saint-Henri, Montréal »), as a plain fact. */
  area: string | null;
  tagline: string | null;
  cover: { src: string; alt: string; video?: { webm?: string; mp4?: string } } | null;
  status: { open: boolean; label: string; detail: string } | null;
  bookHref: string;
  services: ServiceView[];
  /** Who works here (first names), when several people do, each with where they stand now (akinaza#209) when it is known. */
  team: { id: string; name: string; state: string | null; free: boolean }[];
  zones: { id: string; name: string }[];
  map: { center: LngLat; zoom: number; places: { id: string; name: string; position: LngLat }[] } | null;
  hours: { today: string; status: { open: boolean; label: string; detail?: string }; days: { id: string; label: string; hours: string }[] };
  policies: { id: string; term: string; value: string }[];
  about: { name: string; text: string } | null;
  contact: { phone: string | null; phoneHref: string | null; email: string | null } | null;
  gallery: { id: string; src: string; alt: string; caption?: string; shape: "portrait" | "wide"; video?: { webm?: string; mp4?: string } }[];
  /** The photos are the trade's proposed pictures, not the shop's own (#267): the page says so, never « Photos de {shop} ». */
  galleryIllustrative: boolean;
  logoUrl: string | null;
  sections: { id: "services" | "team" | "hours" | "zones" | "trust" | "gallery" | "wall" | "reels" | "announcements" | "reviews" | "follow"; visible: boolean }[];
  /** The template the shop applied (#261), or null: a shop with none renders exactly as before. Its order is already in `sections`; the variants and the hue are drawn here. */
  template: { id: string; version: number; layout: string; hue: string; variants: Record<string, string> } | null;
  preparedSections: Record<"wall" | "reels" | "announcements" | "reviews" | "follow", boolean>;
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

const lang = (locale: Locale) => (locale === "fr" ? "fr-CA" : "en-CA");
const dayName = (day: string, locale: Locale, weekday: "short" | "long") => new Intl.DateTimeFormat(lang(locale), { timeZone: "UTC", weekday }).format(new Date(`${day}T12:00:00Z`));
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

const longDate = (day: string, locale: Locale) => new Intl.DateTimeFormat(lang(locale), { timeZone: "UTC", day: "numeric", month: "long" }).format(new Date(`${day}T12:00:00Z`));

/** One member on the public page: a first name and one state, never a client, a service or a reason (akinaza#209). */
function memberView(member: { id: string; name: string }, day: MemberDay | undefined, now: Date, timezone: string, locale: Locale, t: ReturnType<typeof translator>): StorefrontView["team"][number] {
  if (!day) return { id: member.id, name: member.name, state: null, free: false };
  const state = memberStateAt(day, now, timezone);
  const label =
    state.kind === MEMBER_STATE.busy
      ? t("console.shopPage.member.busy", { time: clockLabel(state.until, locale) })
      : state.kind === MEMBER_STATE.startsAt
        ? t("console.shopPage.member.startsAt", { time: clockLabel(state.time, locale) })
        : state.kind === MEMBER_STATE.off
          ? t("console.shopPage.member.off", { day: longDate(state.until, locale) })
          : t(`console.shopPage.member.${state.kind}`);
  return { id: member.id, name: member.name, state: label, free: state.kind === MEMBER_STATE.free };
}

export function buildStorefront(input: { page: PublicShop; locale: Locale; /** The language of the shop's own texts when it is not the product's (a Spanish page); defaults to `locale`. */ contentLocale?: PageLocale; /** The proposed images of the shop's type, when the page shows them (#267): used where the owner has none. */ defaults?: ResolvedDefaults; now: Date; teamDay?: ReadonlyMap<string, MemberDay>; enabledUpcomingSections?: Partial<Record<"wall" | "reels" | "announcements" | "reviews" | "follow", boolean>> }): StorefrontView {
  const { page, locale, now } = input;
  const t = translator(locale);
  const timezone = page.shop.timezone;
  const base = `/${locale}/s/${page.shop.slug}`;
  const pick = (fr: string | null | undefined, en: string | null | undefined) => (locale === "fr" ? fr : en) || null;
  // The shop's own texts, in the page's content language: what the owner wrote in it, else its translation (automatic or edited), else the source language.
  const content = input.contentLocale ?? locale;
  const translated = new Map((page.translations ?? []).map((x) => [`${x.key}|${x.locale}`, x.text]));
  const sourceIsFr = (page.languages?.source ?? "fr") === "fr";
  const own = (kind: "shop" | "service", refId: string, field: string, fr: string | null | undefined, en: string | null | undefined): string | null => {
    const written = content === "fr" ? fr : content === "en" ? en : null;
    if (written?.trim()) return written;
    const done = translated.get(`${kind}:${refId}:${field}|${content}`);
    if (done) return done;
    return (sourceIsFr ? fr || en : en || fr)?.trim() || null;
  };
  const { serviceId, zoneId } = resolveSelection(page, {});
  /** A service has its own page; the first area is kept in the address when the shop travels. */
  const pageHref = (service: string) => serviceHref(locale, page.shop.slug ?? "", service, { zoneId });

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

  // The proposed images (#267): described in the page's language; used only where the owner has no media of their own.
  const proposed = input.defaults;
  const describe = (altKey: string) => t(`console.${altKey}` as never, {} as never);
  const asImage = (d: DefaultImage): ServiceImage => ({ id: d.id, alt: describe(d.altKey), src: d.src, sources: d.sources, width: d.width, height: d.height });
  const image = (index: number): ServiceImage | null => (proposed?.service.length ? asImage(proposed.service[index % proposed.service.length]!) : null);

  // Services, as cards.
  const unit = pick(page.shop.seatUnitFr, page.shop.seatUnitEn);
  const services: ServiceView[] = page.services.map((s, index) => ({
    id: s.id,
    name: own("service", s.id, "name", s.nameFr, s.nameEn) ?? s.nameFr,
    description: own("service", s.id, "description", s.descriptionFr, s.descriptionEn),
    included: (own("service", s.id, "included", s.includedFr.join("\n"), s.includedEn.join("\n")) ?? "").split("\n").filter(Boolean),
    duration: t("console.shopPage.minutes", { minutes: s.durationMinutes }),
    capacity: s.capacity > 1 ? (unit ? t("console.shopPage.capacityUnit", { count: s.capacity, unit }) : t("console.shopPage.capacitySeats", { count: s.capacity })) : null,
    price: money(s.priceCents, locale),
    priceFrom: s.priceVaries ? t("console.shopPage.from") : null,
    tag: s.id === page.popularServiceId ? t("console.shopPage.popular") : null,
    href: pageHref(s.id),
    image: image(index),
  }));

  // Where: chips and a map of the places that have a position.
  const placed = page.zones.filter((z) => z.lat !== null && z.lng !== null).map((z) => ({ id: z.id, name: z.name, position: [z.lng!, z.lat!] as LngLat }));
  const map = placed.length
    ? { center: [placed.reduce((n, p) => n + p.position[0], 0) / placed.length, placed.reduce((n, p) => n + p.position[1], 0) / placed.length] as LngLat, zoom: zoomFor(placed.map((p) => p.position)), places: placed }
    : null;

  // The week, compact, today marked.
  const today = localDay(now, timezone);
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

  const bio = own("shop", page.shop.id, "bio", page.shop.bioFr, page.shop.bioEn);
  const phone = page.shop.publicPhone;
  const email = page.shop.publicEmail;
  const pageSections = page.pageConfig?.sections ?? ["services", "team", "hours", "zones", "trust", "gallery", "wall", "reels", "announcements", "reviews", "follow"].map((id) => ({ id, visible: true }));
  const enabled = input.enabledUpcomingSections ?? {};
  // A shop that never applied a template (or whose template the catalogue no longer holds) renders exactly as it always did.
  const appliedTemplate = resolveTemplate({ templateId: page.pageConfig?.templateId, templateVersion: page.pageConfig?.templateVersion });
  const preparedSections = { wall: enabled.wall ?? false, reels: enabled.reels ?? false, announcements: enabled.announcements ?? false, reviews: enabled.reviews ?? false, follow: enabled.follow ?? false };

  return {
    name: page.shop.name,
    area: page.shop.area || null,
    tagline: own("shop", page.shop.id, "tagline", page.shop.taglineFr, page.shop.taglineEn),
    cover: page.media.cover ? mediaView(page.media.cover, locale) : proposed?.cover ? { src: proposed.cover.poster, alt: describe(proposed.cover.altKey), video: { webm: proposed.cover.webm, mp4: proposed.cover.mp4 } } : null,
    status,
    bookHref: serviceId ? pageHref(serviceId) : base,
    services,
    team: page.team.length > 1 ? page.team.map((m) => memberView(m, input.teamDay?.get(m.id), now, timezone, locale, t)) : [],
    zones: page.zones.map((z) => ({ id: z.id, name: z.name })),
    map,
    hours: { today: todayId, status: status ?? { open: false, label: t("console.shopPage.closed") }, days: week },
    policies,
    about: bio ? { name: page.shop.ownerName, text: bio } : null,
    contact: phone || email ? { phone: phone || null, phoneHref: phone ? telHref(phone) : null, email: email || null } : null,
    gallery: page.media.gallery.length
      ? page.media.gallery.map((m) => ({ id: m.id, ...mediaView(m, locale), ...(pick(m.captionFr, m.captionEn) ? { caption: pick(m.captionFr, m.captionEn)! } : {}), shape: m.wide ? ("wide" as const) : ("portrait" as const) }))
      : (proposed?.gallery ?? []).map((d) => ({ id: d.id, src: d.src, alt: describe(d.altKey), shape: "portrait" as const })),
    galleryIllustrative: page.media.gallery.length === 0 && (proposed?.gallery.length ?? 0) > 0,
    logoUrl: page.pageConfig?.logoUrl ?? null,
    sections: pageSections.map((section) => ({
      ...section,
      visible: section.visible && (section.id in preparedSections ? preparedSections[section.id as keyof typeof preparedSections] : true),
    })) as StorefrontView["sections"],
    template: appliedTemplate && { id: appliedTemplate.id, version: appliedTemplate.version, layout: appliedTemplate.layout, hue: appliedTemplate.hue, variants: Object.fromEntries(appliedTemplate.sections.map((x) => [x.id, x.variant])) },
    preparedSections,
  };
}

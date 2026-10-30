import { addLocalDays, groupSlotsByDay, invoiceTotals, localDay } from "@akinaza/core";
import type { BookingDetail, PublicShop, StaffSlot } from "@akinaza/db";

import { type Locale, translator } from "@/lib/i18n";
import { type Choice, confirmHref, journeyBase, serviceHref, timesHref } from "@/lib/journey-paths";
import { groupByPart, hourIn } from "@/lib/slot-weeks";
import { clockLabel } from "@/lib/storefront";

export { type Choice, journeyBase, serviceHref, timesHref };

/**
 * The public booking journey, one route per step (the URL is the state): the shop → a service → its times → the confirmation.
 * Each step is computed here from the shop's data and the clock, pure: `now` and the time zone are parameters, the words come
 * from the catalogues, the addresses are built here. Nothing is shown that the engine does not run.
 */
const lang = (locale: Locale) => (locale === "fr" ? "fr-CA" : "en-CA");
const money = (cents: number, locale: Locale) => new Intl.NumberFormat(lang(locale), { style: "currency", currency: "CAD" }).format(cents / 100);
const clock = (instant: Date, timezone: string, locale: Locale) => clockLabel(new Intl.DateTimeFormat("en-CA", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(instant), locale);
const dayLabel = (day: string, locale: Locale, style: "short" | "long") => new Intl.DateTimeFormat(lang(locale), { timeZone: "UTC", weekday: style, ...(style === "long" ? { day: "numeric", month: "long" } : {}) }).format(new Date(`${day}T12:00:00Z`));
const dayMonth = (day: string, locale: Locale) => new Intl.DateTimeFormat(lang(locale), { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${day}T12:00:00Z`));

/** A published shop always has an address. */
const slugOf = (page: PublicShop): string => page.shop.slug ?? "";

/** The person and the area the address names, when the shop has them (anything else is « anyone » / the first area). */
export function resolveChoice(page: PublicShop, raw: { staff?: string | null; zone?: string | null }): { staffId: string | null; zoneId: string | null } {
  return {
    staffId: page.team.some((m) => m.id === raw.staff) ? (raw.staff ?? null) : null,
    zoneId: page.zones.some((z) => z.id === raw.zone) ? (raw.zone ?? null) : (page.zones[0]?.id ?? null),
  };
}

export interface ServiceStep {
  name: string;
  description: string | null;
  included: string[];
  duration: string;
  /** « 160 $ » or « From 160 $ ». */
  price: string;
  free: boolean;
  /** « 75 $ + TPS 3,75 $ + TVQ 7,48 $ = 86,23 $ » — exact, only for a shop registered for the taxes. */
  taxLine: string | null;
  cancelRule: string;
  /** Who: shown only when several people work here; « anyone » first. */
  team: { id: string; name: string; selected: boolean; href: string }[];
  /** The areas, for a shop that goes to its clients. */
  zones: { id: string; name: string; selected: boolean; href: string }[];
  timesHref: string;
  backHref: string;
}

/** One service: what it is, what it costs to the cent, the cancellation rule, who may take it. */
export function serviceStep(input: { page: PublicShop; locale: Locale; serviceId: string; staffId: string | null; zoneId?: string | null }): ServiceStep | null {
  const { page, locale } = input;
  const service = page.services.find((s) => s.id === input.serviceId);
  if (!service) return null;
  const t = translator(locale);
  const { staffId, zoneId } = resolveChoice(page, { staff: input.staffId, zone: input.zoneId });
  const free = service.priceCents === 0;
  const totals = invoiceTotals([{ description: service.nameEn, quantity: 1, unitPriceCents: service.priceCents, category: "standard" }], { registrant: page.shop.registrant });
  const listed = service.priceVaries ? t("console.journey.fromPrice", { price: money(service.priceCents, locale) }) : money(service.priceCents, locale);
  const price = free ? t("console.journey.freeService") : listed;
  const pick = (fr: string | null, en: string | null) => (locale === "fr" ? fr : en) || null;
  return {
    name: locale === "fr" ? service.nameFr : service.nameEn,
    description: pick(service.descriptionFr, service.descriptionEn),
    included: locale === "fr" ? service.includedFr : service.includedEn,
    duration: t("console.shopPage.minutes", { minutes: service.durationMinutes }),
    price,
    free,
    taxLine: page.shop.registrant && !free ? t("console.journey.taxLine", { price: money(totals.subtotalCents, locale), gst: money(totals.gstCents, locale), qst: money(totals.qstCents, locale), total: money(totals.totalCents, locale) }) : null,
    cancelRule: t("console.journey.cancelRule", { hours: page.rules.cancellationHours }),
    team:
      page.team.length > 1
        ? [{ id: "", name: t("console.journey.anyone"), selected: staffId === null, href: serviceHref(locale, slugOf(page), service.id, { zoneId }) }, ...page.team.map((m) => ({ id: m.id, name: m.name, selected: staffId === m.id, href: serviceHref(locale, slugOf(page), service.id, { staffId: m.id, zoneId }) }))]
        : [],
    zones: page.zones.length > 1 ? page.zones.map((z) => ({ id: z.id, name: z.name, selected: zoneId === z.id, href: serviceHref(locale, slugOf(page), service.id, { staffId, zoneId: z.id }) })) : [],
    timesHref: timesHref(locale, slugOf(page), service.id, { staffId, zoneId }),
    backHref: journeyBase(locale, slugOf(page)),
  };
}

export interface TimesStep {
  title: string;
  who: string | null;
  days: { id: string; label: string; sub: string; slots: { id: string; label: string; href: string }[]; groups: { id: string; label: string; slots: { id: string; label: string; href: string }[] }[] }[];
  /** The shop's clock, said under the times. */
  footer: string;
  changeHref: string | null;
  backHref: string;
}

/** The times that are really free for a service and a person (or anyone), each a link that opens the booking with everything chosen. */
export function timesStep(input: { page: PublicShop; locale: Locale; now: Date; serviceId: string; staffId: string | null; zoneId?: string | null; slots: readonly StaffSlot[] }): TimesStep | null {
  const { page, locale, now } = input;
  const service = page.services.find((s) => s.id === input.serviceId);
  if (!service) return null;
  const t = translator(locale);
  const timezone = page.shop.timezone;
  const { staffId, zoneId } = resolveChoice(page, { staff: input.staffId, zone: input.zoneId });
  const person = page.team.find((m) => m.id === staffId) ?? null;
  const today = localDay(now, timezone);
  const tomorrow = addLocalDays(today, 1);
  return {
    title: locale === "fr" ? service.nameFr : service.nameEn,
    who: person ? t("console.journey.with", { name: person.name }) : (page.team.length > 1 && t("console.journey.anyone")) || null,
    footer: t("console.journey.timesFooter", { zone: timezone }),
    days: groupSlotsByDay(input.slots, timezone, { maxDays: 14, maxPerDay: 12 }).map((d) => {
      const named: Record<string, string> = { [today]: t("console.shopPage.today"), [tomorrow]: t("console.shopPage.tomorrow") };
      const slot = (s: { startsAt: Date }) => ({
        id: s.startsAt.toISOString(),
        label: clock(s.startsAt, timezone, locale),
        href: confirmHref(locale, slugOf(page), service.id, { staffId: person?.id, zoneId }, s.startsAt.toISOString()),
      });
      return {
        id: d.day,
        label: named[d.day] ?? dayLabel(d.day, locale, "short"),
        sub: dayMonth(d.day, locale),
        slots: d.slots.map(slot),
        groups: groupByPart(d.slots, (s) => hourIn(s.startsAt, timezone)).map((g) => ({ id: g.part, label: t(`console.journey.parts.${g.part}`), slots: g.items.map(slot) })),
      };
    }),
    changeHref: page.team.length > 1 || page.zones.length > 1 ? serviceHref(locale, slugOf(page), service.id, { staffId: person?.id, zoneId }) : null,
    backHref: serviceHref(locale, slugOf(page), service.id, { staffId: person?.id, zoneId }),
  };
}

export interface ConfirmationStep {
  title: string;
  when: string;
  who: string;
  where: string;
  price: string;
  cancelled: boolean;
  cancellable: boolean;
  cancelRule: string;
  calendarHref: string;
  phone: string | null;
  phoneHref: string | null;
}

/** The confirmation: when, with whom, where, what it costs, the cancellation rule, add to calendar. */
export function confirmationStep(input: { detail: BookingDetail; locale: Locale }): ConfirmationStep {
  const { detail, locale } = input;
  const t = translator(locale);
  const day = localDay(detail.startsAt, detail.timezone);
  const phone = detail.shop.publicPhone;
  const digits = phone?.replace(/\D/g, "") ?? "";
  const dialled = digits.length === 10 ? `+1${digits}` : `+${digits}`;
  return {
    title: locale === "fr" ? detail.service.nameFr : detail.service.nameEn,
    when: `${dayLabel(day, locale, "long")} · ${clock(detail.startsAt, detail.timezone, locale)}`,
    who: detail.staffName,
    where: `${detail.shop.name} — ${detail.shop.address}`,
    price: detail.service.priceCents === 0 ? t("console.journey.freeService") : money(detail.service.priceCents, locale),
    cancelled: detail.cancelled,
    cancellable: detail.cancellable,
    cancelRule: t("console.journey.cancelRule", { hours: detail.cancellationHours }),
    calendarHref: `/api/me/bookings/${detail.id}/calendar`,
    phone: phone ?? null,
    phoneHref: digits.length >= 7 ? `tel:${dialled}` : null,
  };
}

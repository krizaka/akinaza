import { getDateTimeFormat } from "@krizaka/intl";

import { localDay, weekdayOf } from "./service-shop";

/** What a visitor of Explorer may know of a shop: its public page's facts, nothing of its clients or its street address. */
export interface ExploreShop {
  slug: string;
  name: string;
  kind: "salon" | "boutique" | "services" | "other";
  /** The locality shown on the page (« Saint-Henri »). */
  area: string | null;
  taglineFr: string | null;
  taglineEn: string | null;
  /** The areas the shop serves (its zones' names): the quartiers it is found in. */
  quartiers: string[];
  /** Where the shop serves from (WGS 84 `[lng, lat]`), the first zone with a position; null = listed, not on the map. */
  point: readonly [number, number] | null;
  openNow: boolean;
  freeToday: boolean;
}

export interface ExploreFilters {
  kind: ExploreShop["kind"] | null;
  openNow: boolean;
  freeToday: boolean;
}

export const NO_FILTERS: ExploreFilters = { kind: null, openNow: false, freeToday: false };

const EARTH_RADIUS_M = 6_371_000;

/** The great-circle distance in metres between two `[lng, lat]` points (haversine). */
export function distanceBetween(a: readonly [number, number], b: readonly [number, number]): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

const minutesOfClock = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));

/** Is the shop open at `now`: inside one of its weekly windows (in its own zone), and the day is not a day off. */
export function isOpenNow(windows: readonly { weekday: number; startsAt: string; endsAt: string }[], daysOff: readonly string[], timezone: string, now: Date): boolean {
  const day = localDay(now, timezone);
  if (daysOff.includes(day)) return false;
  const parts = getDateTimeFormat("en", { timeZone: timezone, hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(now);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const minutes = part("hour") * 60 + part("minute");
  const weekday = weekdayOf(day);
  return windows.some((w) => w.weekday === weekday && minutesOfClock(w.startsAt) <= minutes && minutes < minutesOfClock(w.endsAt));
}

/** The shops that pass every filter that is on. */
export function filterShops<T extends ExploreShop>(shops: readonly T[], filters: ExploreFilters): T[] {
  return shops.filter((s) => (filters.kind === null || s.kind === filters.kind) && (!filters.openNow || s.openNow) && (!filters.freeToday || s.freeToday));
}

export type RankedShop<T extends ExploreShop = ExploreShop> = T & { distanceMeters: number | null };

/**
 * The shops nearest first from `origin`; a shop with no position goes after the others, in its name's order. Without an origin the
 * order is the name's (no ranking is invented). A stable, deterministic order: the same input gives the same list.
 */
export function rankByDistance<T extends ExploreShop>(shops: readonly T[], origin: readonly [number, number] | null): RankedShop<T>[] {
  const ranked = shops.map((s) => ({ ...s, distanceMeters: origin && s.point ? Math.round(distanceBetween(origin, s.point)) : null }));
  return ranked.sort((a, b) => {
    if (a.distanceMeters !== null && b.distanceMeters !== null && a.distanceMeters !== b.distanceMeters) return a.distanceMeters - b.distanceMeters;
    if ((a.distanceMeters === null) !== (b.distanceMeters === null)) return a.distanceMeters === null ? 1 : -1;
    return a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug);
  });
}

/** The distinct quartiers of a list of shops, sorted. */
export function quartiersOf(shops: readonly ExploreShop[]): string[] {
  return [...new Set(shops.flatMap((s) => s.quartiers))].sort((a, b) => a.localeCompare(b));
}

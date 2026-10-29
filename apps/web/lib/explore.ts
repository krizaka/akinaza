import type { ExploreShop } from "@akinaza/core";

// @fixed: below a kilometre a distance is said in metres, rounded to ten (a shop's position is its area's centre, not its door)
const METRES_BELOW = 1000;
// @fixed: the rounding of a distance in metres
const METRE_STEP = 10;

/** « 350 m », « 1,2 km »: said in the visitor's language. */
export function distanceLabel(meters: number, locale: string): string {
  if (meters < METRES_BELOW) return `${new Intl.NumberFormat(locale).format(Math.max(METRE_STEP, Math.round(meters / METRE_STEP) * METRE_STEP))} m`;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(meters / 1000)} km`;
}

/** The place Explorer ranks from: an address found, or the visitor's own position (never stored). */
export interface Origin {
  /** `[lng, lat]`. */
  point: readonly [number, number];
  /** The found address's label; null = the visitor's position. */
  label: string | null;
}

/** The map's first view: the origin, else the middle of the shops that have a position, else the middle of Montréal. */
export function mapCenter(shops: readonly ExploreShop[], origin: Origin | null): readonly [number, number] {
  // @fixed: Montréal's centre, the map's view when there is nothing to centre on
  const MONTREAL: readonly [number, number] = [-73.5673, 45.5017];
  if (origin) return origin.point;
  const points = shops.flatMap((s) => (s.point ? [s.point] : []));
  if (!points.length) return MONTREAL;
  return [points.reduce((n, p) => n + p[0], 0) / points.length, points.reduce((n, p) => n + p[1], 0) / points.length];
}

/** Does the browser let a page ask for a position. */
export const canLocate = () => typeof navigator !== "undefined" && "geolocation" in navigator;

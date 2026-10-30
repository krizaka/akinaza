/**
 * Geocoding behind a port (krizaka/akinaza#235): Explorer turns an address or a postal code into a place through `GeocodingPort`,
 * never through a vendor named in the code. The adapter is chosen by the environment (`lib/geocoding-adapter.ts`); a test passes a
 * fake. The attribution travels with the port and is shown wherever its answers are. A shared package is asked for in krizaka-ts
 * (krizaka/krizaka-ts#180); until it lands this seam is the contract it will fill.
 */
export interface GeoPlace {
  /** How the place is named to the visitor. */
  label: string;
  lat: number;
  lng: number;
}

export interface GeoAttribution {
  text: string;
  href: string;
}

export interface GeocodingPort {
  readonly attribution: GeoAttribution;
  /** Places matching a typed address or postal code, best first; an empty list when nothing matches. */
  search(query: string, options: { locale: string; signal?: AbortSignal }): Promise<GeoPlace[]>;
}

// @fixed: a query is an address, never a paragraph
export const MAX_QUERY = 120;
// @fixed: the shortest query worth a request (a postal code's first three characters)
export const MIN_QUERY = 3;
/** A Canadian postal code, with or without its space, any case: `H2X 1Y4`, `h2x1y4`, and its first three characters. */
const POSTAL_CODE = /^([A-Za-z]\d[A-Za-z])\s?(\d[A-Za-z]\d)?$/;

/** The query as it is asked and cached: trimmed, spaces collapsed, a postal code in its canonical form (`H2X 1Y4`). null = too short or too long. */
export function normaliseQuery(raw: string): string | null {
  const q = raw.trim().replace(/\s+/g, " ");
  if (q.length < MIN_QUERY || q.length > MAX_QUERY) return null;
  const postal = POSTAL_CODE.exec(q);
  return postal ? [postal[1], postal[2]].filter(Boolean).join(" ").toUpperCase() : q;
}

/** A port that remembers recent answers, so a repeated search costs the vendor nothing (a vendor's usage policy asks for it). */
export function cachedGeocoder(port: GeocodingPort, options: { ttlMs: number; max: number; now?: () => number }): GeocodingPort {
  const now = options.now ?? Date.now;
  const memory = new Map<string, { at: number; places: GeoPlace[] }>();
  return {
    attribution: port.attribution,
    async search(query, o) {
      const key = `${o.locale}|${query.toLowerCase()}`;
      const hit = memory.get(key);
      if (hit && now() - hit.at < options.ttlMs) return hit.places;
      const places = await port.search(query, o);
      if (memory.size >= options.max) memory.delete(memory.keys().next().value!);
      memory.set(key, { at: now(), places });
      return places;
    },
  };
}

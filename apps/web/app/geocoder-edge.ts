import { env } from "@/lib/env";
import { cachedGeocoder, type GeocodingPort } from "@/lib/geocoding";
import { httpGeocoder } from "@/lib/geocoding-adapter";

// @fixed: an address keeps its answer a day; the vendor's usage policy asks for a cache
const TTL_MS = 24 * 3_600_000;
// @fixed: the memory bound of the cache
const MAX_ENTRIES = 500;

let instance: { key: string; port: GeocodingPort } | null = null;

/** The geocoder the environment names, cached; null when none is configured (the address search is then off). */
export function geocoder(): GeocodingPort | null {
  const e = env();
  if (!e.APP_GEOCODER_URL) return null;
  const key = `${e.APP_GEOCODER_URL}|${e.APP_GEOCODER_ATTRIBUTION_TEXT}|${e.APP_GEOCODER_ATTRIBUTION_URL}`;
  if (instance?.key !== key) {
    const attribution = { text: e.APP_GEOCODER_ATTRIBUTION_TEXT ?? new URL(e.APP_GEOCODER_URL).hostname, href: e.APP_GEOCODER_ATTRIBUTION_URL ?? e.APP_GEOCODER_URL };
    instance = { key, port: cachedGeocoder(httpGeocoder({ url: e.APP_GEOCODER_URL, attribution }), { ttlMs: TTL_MS, max: MAX_ENTRIES }) };
  }
  return instance.port;
}

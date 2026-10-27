import type { GeoAttribution, GeocodingPort, GeoPlace } from "./geocoding";

// @fixed: a handful of suggestions is a list a visitor reads
const RESULTS = 5;
// @fixed: a geocoder that does not answer in this long is down, the page says so
const TIMEOUT_MS = 4000;

interface Row {
  display_name?: unknown;
  lat?: unknown;
  lon?: unknown;
}

/**
 * The adapter for a geocoding service that answers `GET <url>?q=…&format=json` with `[{ display_name, lat, lon }]` (the Nominatim
 * protocol, which several providers and self-hosted servers speak). The service, its address and its attribution are the
 * environment's (`APP_GEOCODER_URL`, `APP_GEOCODER_ATTRIBUTION_*`): nothing here names a vendor. Results are limited to Canada.
 */
export function httpGeocoder(config: { url: string; attribution: GeoAttribution; fetcher?: typeof fetch }): GeocodingPort {
  const fetcher = config.fetcher ?? fetch;
  return {
    attribution: config.attribution,
    async search(query, { locale, signal }) {
      const url = new URL(config.url);
      url.search = new URLSearchParams({ q: query, format: "json", limit: String(RESULTS), countrycodes: "ca", "accept-language": locale }).toString();
      const res = await fetcher(url, { headers: { "User-Agent": "Akinaza/1.0 (+https://www.akinaza.com)", Accept: "application/json" }, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]) : AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) throw new Error(`geocoder answered ${res.status}`);
      const rows = (await res.json()) as Row[];
      return (Array.isArray(rows) ? rows : []).flatMap((r): GeoPlace[] => {
        const lat = Number(r.lat);
        const lng = Number(r.lon);
        return typeof r.display_name === "string" && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [{ label: r.display_name, lat, lng }] : [];
      });
    },
  };
}

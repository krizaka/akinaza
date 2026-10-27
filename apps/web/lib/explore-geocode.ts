import { type GeoAttribution, type GeocodingPort, type GeoPlace, normaliseQuery } from "./geocoding";
import { refuse } from "./http";

export interface GeocodeAnswer {
  places: GeoPlace[];
  attribution: GeoAttribution;
}

/** The search route's logic apart from HTTP: validates the query, asks the port, turns a vendor failure into a 502 that names no vendor. */
export async function geocodeAnswer(port: GeocodingPort | null, rawQuery: string, locale: string, signal?: AbortSignal): Promise<GeocodeAnswer> {
  if (!port) throw refuse(503, "GEOCODER_OFF", "Address search is not configured");
  const query = normaliseQuery(rawQuery);
  if (!query) throw refuse(400, "BAD_QUERY", "Query too short or too long");
  try {
    return { places: await port.search(query, { locale, ...(signal ? { signal } : {}) }), attribution: port.attribution };
  } catch {
    throw refuse(502, "GEOCODER_FAILED", "Address search is unavailable");
  }
}

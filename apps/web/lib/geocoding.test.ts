import { describe, expect, it } from "vitest";

import { geocodeAnswer } from "./explore-geocode";
import { cachedGeocoder, type GeocodingPort, type GeoPlace, normaliseQuery } from "./geocoding";
import { httpGeocoder } from "./geocoding-adapter";
import { HttpError } from "./http";

const place: GeoPlace = { label: "1 rue Exemple, Montréal", lat: 45.5, lng: -73.57 };
/** A fake adapter: the port is the seam, so no network and no vendor in a test. */
function fake(places: GeoPlace[] = [place]): GeocodingPort & { calls: string[] } {
  const calls: string[] = [];
  return { calls, attribution: { text: "Fake maps", href: "https://example.test/credits" }, async search(q) { calls.push(q); return places; } };
}

describe("a typed address, normalised", () => {
  it("canonicalises a postal code (any case, with or without the space, or its first three characters)", () => {
    expect(normaliseQuery("h2x1y4")).toBe("H2X 1Y4");
    expect(normaliseQuery(" H2x   1y4 ")).toBe("H2X 1Y4");
    expect(normaliseQuery("h2x")).toBe("H2X");
  });
  it("keeps an address as typed (spaces collapsed) and refuses a query too short or too long", () => {
    expect(normaliseQuery("  1  rue   Exemple ")).toBe("1 rue Exemple");
    expect(normaliseQuery("ab")).toBeNull();
    expect(normaliseQuery("x".repeat(121))).toBeNull();
  });
});

describe("the cache in front of the port", () => {
  it("asks the vendor once for the same search, whatever its case, and again after the TTL", async () => {
    const port = fake();
    let t = 0;
    const cached = cachedGeocoder(port, { ttlMs: 1000, max: 10, now: () => t });
    await cached.search("1 rue Exemple", { locale: "fr" });
    await cached.search("1 RUE EXEMPLE", { locale: "fr" });
    expect(port.calls).toHaveLength(1);
    await cached.search("1 rue Exemple", { locale: "en" });
    expect(port.calls).toHaveLength(2);
    t = 2000;
    await cached.search("1 rue Exemple", { locale: "fr" });
    expect(port.calls).toHaveLength(3);
  });
  it("is bounded, and carries the attribution through", async () => {
    const port = fake();
    const cached = cachedGeocoder(port, { ttlMs: 1000, max: 2, now: () => 0 });
    for (const q of ["aaa", "bbb", "ccc", "aaa"]) await cached.search(q, { locale: "en" });
    expect(port.calls).toEqual(["aaa", "bbb", "ccc", "aaa"]);
    expect(cached.attribution.text).toBe("Fake maps");
  });
});

describe("the search answer (what the route sends)", () => {
  it("returns the places with the attribution to show", async () => {
    expect(await geocodeAnswer(fake(), "h2x1y4", "fr")).toEqual({ places: [place], attribution: { text: "Fake maps", href: "https://example.test/credits" } });
  });
  it("asks the port the normalised query", async () => {
    const port = fake();
    await geocodeAnswer(port, "h2x1y4", "fr");
    expect(port.calls).toEqual(["H2X 1Y4"]);
  });
  it("refuses: 503 when no geocoder is set, 400 for a bad query, 502 (no vendor named) when the vendor fails", async () => {
    await expect(geocodeAnswer(null, "h2x1y4", "fr")).rejects.toMatchObject({ status: 503 });
    await expect(geocodeAnswer(fake(), "ab", "fr")).rejects.toMatchObject({ status: 400 });
    const broken: GeocodingPort = { attribution: { text: "x", href: "https://example.test" }, search: async () => { throw new Error("vendor.example down"); } };
    const error = await geocodeAnswer(broken, "h2x1y4", "fr").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(502);
    expect((error as HttpError).message).not.toMatch(/vendor/);
  });
});

describe("the HTTP adapter (Nominatim protocol, the service is the environment's)", () => {
  it("asks for Canada, in the language, and reads display_name / lat / lon; drops rows that are not a place", async () => {
    let asked = "";
    const fetcher = (async (url: URL) => {
      asked = String(url);
      return Response.json([{ display_name: "Montréal", lat: "45.5", lon: "-73.5" }, { display_name: "Nowhere", lat: "x", lon: "1" }, { lat: 1, lon: 1 }, { display_name: "Far", lat: 95, lon: 0 }]);
    }) as unknown as typeof fetch;
    const port = httpGeocoder({ url: "https://geo.example.test/search", attribution: { text: "Geo", href: "https://geo.example.test" }, fetcher });
    expect(await port.search("H2X", { locale: "fr" })).toEqual([{ label: "Montréal", lat: 45.5, lng: -73.5 }]);
    expect(asked).toContain("countrycodes=ca");
    expect(asked).toContain("accept-language=fr");
    expect(asked).toContain("q=H2X");
  });
  it("throws on a vendor error, so the route can answer 502", async () => {
    const fetcher = (async () => new Response("no", { status: 500 })) as unknown as typeof fetch;
    await expect(httpGeocoder({ url: "https://geo.example.test/s", attribution: { text: "g", href: "https://geo.example.test" }, fetcher }).search("H2X", { locale: "en" })).rejects.toThrow();
  });
});

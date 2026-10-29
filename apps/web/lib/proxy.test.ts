import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { config, proxy } from "../proxy";
import { LOCALE_HEADER, PATH_HEADER } from "./locale-negotiation";

const get = (path: string) => proxy(new NextRequest(`https://dev.akinaza.com${path}`, { headers: { host: "dev.akinaza.com" } }));

beforeEach(() => vi.stubEnv("APP_ALLOWED_HOSTS", "dev.akinaza.com"));
afterEach(() => vi.unstubAllEnvs());

describe("the proxy of a deployment closed to search engines (APP_SEARCH_INDEXING=off)", () => {
  it("noindexes every page, closes robots.txt (with its Sitemap line) and still serves the sitemap, noindexed", async () => {
    vi.stubEnv("APP_SEARCH_INDEXING", "off");
    expect(get("/en").headers.get("x-robots-tag")).toBe("noindex, nofollow");
    const robots = get("/robots.txt");
    expect(robots.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(await robots.text()).toBe("User-agent: *\nDisallow: /\nSitemap: https://www.akinaza.com/sitemap.xml\n");
    const sitemap = get("/sitemap.xml");
    expect(sitemap.status).toBe(200);
    expect(sitemap.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("leaves an open deployment alone", () => {
    const open = (path: string) => proxy(new NextRequest(`https://www.akinaza.com${path}`, { headers: { host: "www.akinaza.com" } }));
    expect(open("/en").headers.get("x-robots-tag")).toBeNull();
    expect(open("/sitemap.xml").status).toBe(200);
    // ... but a dev.* host is never open, even when the deployment says it is (#249).
    expect(get("/en").headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
});

const as = (host: string, path: string, init: { method?: string } = {}) => proxy(new NextRequest(`https://${host}${path}`, { method: init.method, headers: { host } }));

describe("www.akinaza.com is public, dev.akinaza.com leaves search (epic krizaka/.github#119)", () => {
  const setup = () => {
    vi.stubEnv("APP_SEARCH_INDEXING", "off");
    vi.stubEnv("APP_PUBLIC_URL", "https://www.akinaza.com");
    vi.stubEnv("APP_DEV_HOST", "dev.akinaza.com");
  };

  it("www is indexed even on a deployment that is closed elsewhere: no noindex, robots.txt and the sitemap are the app's", () => {
    setup();
    expect(as("www.akinaza.com", "/en").headers.get("x-robots-tag")).toBeNull();
    expect(as("www.akinaza.com", "/robots.txt").headers.get("content-type")).not.toBe("text/plain");
    expect(as("www.akinaza.com", "/sitemap.xml").status).toBe(200);
  });

  it("dev: a page answers 308 to the same path on www, noindex", () => {
    setup();
    const res = as("dev.akinaza.com", "/en/sign-in?next=%2Fapp");
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("https://www.akinaza.com/en/sign-in?next=%2Fapp");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("dev: robots.txt is Disallow: / with noindex; the API, .well-known and healthz keep serving with noindex", async () => {
    setup();
    const robots = as("dev.akinaza.com", "/robots.txt");
    expect(await robots.text()).toBe("User-agent: *\nDisallow: /\n");
    expect(robots.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    for (const path of ["/api/healthz", "/api/internal/sync", "/.well-known/assetlinks.json", "/healthz"]) {
      const res = as("dev.akinaza.com", path);
      expect(res.status, path).toBe(200);
      expect(res.headers.get("x-robots-tag"), path).toBe("noindex, nofollow");
      expect(res.headers.get("location"), path).toBeNull();
    }
  });

  it("the proxy sees the API and .well-known (to say noindex on dev), not the static files", () => {
    const patterns = config.matcher.join(" ");
    expect(patterns).toContain("/api/:path*");
    expect(patterns).toContain("/.well-known/:path*");
  });

  it("admin stays closed on every response", () => {
    setup();
    expect(as("admin.akinaza.com", "/en").headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
});

describe("the language of the address reaches the pages (the 404 has no params)", () => {
  it("/fr/nope carries fr, /nope carries the visitor's choice", () => {
    const fr = proxy(new NextRequest("https://www.akinaza.com/fr/nope", { headers: { host: "www.akinaza.com", "accept-language": "en" } }));
    expect(fr.headers.get(`x-middleware-request-${LOCALE_HEADER}`)).toBe("fr");
    const en = proxy(new NextRequest("https://www.akinaza.com/en/nope", { headers: { host: "www.akinaza.com" } }));
    expect(en.headers.get(`x-middleware-request-${LOCALE_HEADER}`)).toBe("en");
  });
});

describe("the proxy hands the requested address to the pages (#287)", () => {
  it("carries the path and the query, so the signed-in guard can send the visitor back after sign-in", () => {
    const r = proxy(new NextRequest("https://www.akinaza.com/fr/app/invoices?status=open", { headers: { host: "www.akinaza.com" } }));
    expect(r.headers.get(`x-middleware-request-${PATH_HEADER}`)).toBe("/fr/app/invoices?status=open");
  });
});

describe("the matcher lets a page with a dot in its address through, so its 404 is in the visitor's language (#300 review)", () => {
  // Next runs the proxy only where the matcher says: this is that same pattern, tested as a regular expression.
  const pageMatcher = new RegExp(`^${config.matcher[0]}$`);

  it("runs for /fr/missing.html and for the other addresses that are pages", () => {
    expect(pageMatcher.test("/fr/missing.html")).toBe(true);
    expect(pageMatcher.test("/fr/sign-in")).toBe(true);
    // a dot inside a page address is still a page: the proxy keeps the host isolation (admin.* serves only the console) for it
    expect(pageMatcher.test("/en/app/shop.v2")).toBe(true);
    expect(pageMatcher.test("/fr/app.v2/shop")).toBe(true);
  });

  it("still skips the API, Next's assets and the static files", () => {
    expect(pageMatcher.test("/api/me")).toBe(false);
    expect(pageMatcher.test("/_next/static/chunks/app.js")).toBe(false);
    expect(pageMatcher.test("/_next/image?url=x")).toBe(false);
    expect(pageMatcher.test("/favicon.ico")).toBe(false);
    expect(pageMatcher.test("/og.png")).toBe(false);
    expect(pageMatcher.test("/fonts/inter.woff2")).toBe(false);
    // The maplibre worker is a dotted file that the map loads from its own route (MapSetup): it must bypass the proxy as before.
    expect(pageMatcher.test("/maplibre/maplibre-gl-worker.mjs")).toBe(false);
    // The basemap's tiles (PMTiles) and glyphs (protobuf) under /maps/v1, rewritten to the media CDN, are static files: never a page, never a locale redirect.
    expect(pageMatcher.test("/maps/v1/tiles/12/2048/1360.pbf")).toBe(false);
    expect(pageMatcher.test("/maps/v1/fonts/Noto Sans Regular/0-255.pbf")).toBe(false);
    expect(pageMatcher.test("/maps/v1/tiles/quebec-20261012.pmtiles")).toBe(false);
  });
});

/** ADR-005 slice 3 (#535): the proxy sets the policy of each response; the public shop pages get a fresh nonce, on the request too (Next stamps its scripts with it). */
describe("the Content-Security-Policy of the proxy", () => {
  const at = (host: string, path: string) => proxy(new NextRequest(`https://${host}${path}`, { headers: { host } }));
  const scripts = (response: Response) => (response.headers.get("content-security-policy") ?? "").split("; ").find((d) => d.startsWith("script-src "));
  const nonceOf = (response: Response) => /'nonce-([^']+)'/.exec(scripts(response) ?? "")?.[1];

  it("a public shop page carries a nonce policy, the same nonce on the request, and a fresh one each time", () => {
    const first = at("www.akinaza.com", "/fr/s/pattes-saint-henri");
    const nonce = nonceOf(first);
    expect(nonce).toBeTruthy();
    expect(scripts(first)).not.toContain("'unsafe-inline'");
    expect(first.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(first.headers.get("x-middleware-request-x-nonce")).toBe(nonce);
    expect(first.headers.get("x-middleware-request-content-security-policy")).toBe(first.headers.get("content-security-policy"));
    expect(nonceOf(at("www.akinaza.com", "/fr/s/pattes-saint-henri"))).not.toBe(nonce);
  });
  it("a shop's own host is the same page, so the same strict policy", () => {
    const home = at("pattes.akinaza.com", "/fr");
    expect(nonceOf(home)).toBeTruthy();
  });
  it("the app and the public pages keep the static policy, with no nonce", () => {
    for (const path of ["/fr/app", "/fr", "/fr/explore", "/en/pricing"]) {
      const response = at("www.akinaza.com", path);
      expect(scripts(response), path).toContain("'unsafe-inline'");
      expect(nonceOf(response), path).toBeUndefined();
      expect(response.headers.get("x-middleware-request-x-nonce"), path).toBeNull();
    }
  });
  it("the API has a policy too", () => {
    expect(at("www.akinaza.com", "/api/health").headers.get("content-security-policy")).toContain("default-src 'self'");
  });
  it("drops upgrade-insecure-requests when the declared public origin is plain http, read at request time", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_PUBLIC_URL", "https://www.akinaza.com");
    expect(at("www.akinaza.com", "/fr/s/x").headers.get("content-security-policy")).toContain("upgrade-insecure-requests");
    vi.stubEnv("APP_PUBLIC_URL", "http://localhost:3000");
    expect(at("localhost:3000", "/fr/s/x").headers.get("content-security-policy")).not.toContain("upgrade-insecure-requests");
  });
});

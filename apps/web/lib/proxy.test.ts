import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { config, proxy } from "../proxy";
import { LOCALE_HEADER } from "./locale-negotiation";

const get = (path: string) => proxy(new NextRequest(`https://dev.akinaza.com${path}`, { headers: { host: "dev.akinaza.com" } }));

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

describe("the matcher lets a page with a dot in its address through, so its 404 is in the visitor's language (#300 review)", () => {
  // Next runs the proxy only where the matcher says: this is that same pattern, tested as a regular expression.
  const pageMatcher = new RegExp(`^${config.matcher[0]}$`);

  it("runs for /fr/missing.html and for the other addresses that are pages", () => {
    expect(pageMatcher.test("/fr/missing.html")).toBe(true);
    expect(pageMatcher.test("/en/app/shop.v2")).toBe(true);
    expect(pageMatcher.test("/fr/sign-in")).toBe(true);
  });

  it("still skips the API, Next's assets and the static files", () => {
    expect(pageMatcher.test("/api/me")).toBe(false);
    expect(pageMatcher.test("/_next/static/chunks/app.js")).toBe(false);
    expect(pageMatcher.test("/_next/image?url=x")).toBe(false);
    expect(pageMatcher.test("/favicon.ico")).toBe(false);
    expect(pageMatcher.test("/og.png")).toBe(false);
    expect(pageMatcher.test("/fonts/inter.woff2")).toBe(false);
  });
});

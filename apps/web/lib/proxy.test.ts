import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { config, proxy } from "../proxy";
import { LOCALE_HEADER, PATH_HEADER } from "./locale-negotiation";
import { type ShopVerdict, shopVerdict } from "./shop-directory";

// The shop directory asks the running server: these tests answer for it.
vi.mock("./shop-directory", async (original) => ({ ...(await original<typeof import("./shop-directory")>()), shopVerdict: vi.fn(async () => ({ kind: "shop" })) }));

const get = (path: string) => proxy(new NextRequest(`https://dev.akinaza.com${path}`, { headers: { host: "dev.akinaza.com" } }));

beforeEach(() => vi.stubEnv("APP_ALLOWED_HOSTS", "dev.akinaza.com"));
afterEach(() => vi.unstubAllEnvs());

describe("the proxy of a deployment closed to search engines (APP_SEARCH_INDEXING=off)", () => {
  it("noindexes every page, closes robots.txt (with its Sitemap line) and still serves the sitemap, noindexed", async () => {
    vi.stubEnv("APP_SEARCH_INDEXING", "off");
    expect((await get("/en")).headers.get("x-robots-tag")).toBe("noindex, nofollow");
    const robots = await get("/robots.txt");
    expect(robots.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(await robots.text()).toBe("User-agent: *\nDisallow: /\nSitemap: https://www.akinaza.com/sitemap.xml\n");
    const sitemap = await get("/sitemap.xml");
    expect(sitemap.status).toBe(200);
    expect(sitemap.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("leaves an open deployment alone", async () => {
    const open = (path: string) => proxy(new NextRequest(`https://www.akinaza.com${path}`, { headers: { host: "www.akinaza.com" } }));
    expect((await open("/en")).headers.get("x-robots-tag")).toBeNull();
    expect((await open("/sitemap.xml")).status).toBe(200);
    // ... but a dev.* host is never open, even when the deployment says it is (#249).
    expect((await get("/en")).headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
});

const as = (host: string, path: string, init: { method?: string } = {}) => proxy(new NextRequest(`https://${host}${path}`, { method: init.method, headers: { host } }));

describe("www.akinaza.com is public, dev.akinaza.com leaves search (epic krizaka/.github#119)", () => {
  const setup = () => {
    vi.stubEnv("APP_SEARCH_INDEXING", "off");
    vi.stubEnv("APP_PUBLIC_URL", "https://www.akinaza.com");
    vi.stubEnv("APP_DEV_HOST", "dev.akinaza.com");
  };

  it("www is indexed even on a deployment that is closed elsewhere: no noindex, robots.txt and the sitemap are the app's", async () => {
    setup();
    expect((await as("www.akinaza.com", "/en")).headers.get("x-robots-tag")).toBeNull();
    expect((await as("www.akinaza.com", "/robots.txt")).headers.get("content-type")).not.toBe("text/plain");
    expect((await as("www.akinaza.com", "/sitemap.xml")).status).toBe(200);
  });

  it("dev: a page answers 308 to the same path on www, noindex", async () => {
    setup();
    const res = await as("dev.akinaza.com", "/en/sign-in?next=%2Fapp");
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("https://www.akinaza.com/en/sign-in?next=%2Fapp");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("dev: robots.txt is Disallow: / with noindex; the API, .well-known and healthz keep serving with noindex", async () => {
    setup();
    const robots = await as("dev.akinaza.com", "/robots.txt");
    expect(await robots.text()).toBe("User-agent: *\nDisallow: /\n");
    expect(robots.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    for (const path of ["/api/healthz", "/api/internal/sync", "/.well-known/assetlinks.json", "/healthz"]) {
      const res = await as("dev.akinaza.com", path);
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

  it("admin stays closed on every response", async () => {
    setup();
    expect((await as("admin.akinaza.com", "/en")).headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
});

describe("the language of the address reaches the pages (the 404 has no params)", () => {
  it("/fr/nope carries fr, /nope carries the visitor's choice", async () => {
    const fr = await proxy(new NextRequest("https://www.akinaza.com/fr/nope", { headers: { host: "www.akinaza.com", "accept-language": "en" } }));
    expect(fr.headers.get(`x-middleware-request-${LOCALE_HEADER}`)).toBe("fr");
    const en = await proxy(new NextRequest("https://www.akinaza.com/en/nope", { headers: { host: "www.akinaza.com" } }));
    expect(en.headers.get(`x-middleware-request-${LOCALE_HEADER}`)).toBe("en");
  });
});

describe("the proxy hands the requested address to the pages (#287)", () => {
  it("carries the path and the query, so the signed-in guard can send the visitor back after sign-in", async () => {
    const r = await proxy(new NextRequest("https://www.akinaza.com/fr/app/invoices?status=open", { headers: { host: "www.akinaza.com" } }));
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

// krizaka-ui#827: a signed-in visitor never sees the public landing page; the bar's hint flag follows the session cookie.
describe("a signed-in visitor lands on their home, never on the landing page (krizaka-ui#827)", () => {
  const ask = async (path: string, cookie?: string, host = "www.akinaza.com") => proxy(new NextRequest(`https://${host}${path}`, { headers: { host, ...(cookie ? { cookie } : {}) } }));
  const goes = (res: Response) => (res.headers.get("location") ? new URL(res.headers.get("location")!, "https://www.akinaza.com").pathname : null);

  it("/ , /fr and /en with the session cookie answer 307 to the home in the language, private and varying with the cookie", async () => {
    for (const [path, home, cookie] of [
      ["/", "/fr/app", "akinaza_session=as1.x"],
      ["/", "/en/app", "akinaza_session=as1.x; NEXT_LOCALE=en"],
      ["/fr", "/fr/app", "akinaza_session=as1.x"],
      ["/en", "/en/app", "akinaza_session=as1.x"],
    ] as const) {
      const res = await ask(path, cookie);
      expect(res.status).toBe(307);
      expect(goes(res)).toBe(home);
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(res.headers.get("vary")).toBe("Cookie");
    }
  });
  it("the Location is absolute on the configured public origin, never on the Host the request claims", async () => {
    const res = await proxy(new NextRequest("https://localhost:3000/fr", { headers: { host: "www.akinaza.com", "x-forwarded-host": "evil.example", "x-forwarded-proto": "http", cookie: "akinaza_session=as1.x" } }));
    expect(res.headers.get("location")).toBe(`${(process.env.APP_PUBLIC_URL ?? "https://www.akinaza.com").replace(/\/$/, "")}/fr/app`);
  });
  it("a signed-out visitor still gets the landing page, and a public page stays reachable signed in", async () => {
    expect(goes(await ask("/fr"))).toBeNull();
    expect(goes(await ask("/fr/pricing", "akinaza_session=as1.x"))).toBeNull();
  });
  it("keeps the readable hint flag in step with the cookie on a public page, never carrying the token", async () => {
    const set = (await ask("/fr/pricing", "akinaza_session=as1.tok")).headers.get("set-cookie") ?? "";
    expect(set).toContain("kz-session=1");
    expect(set).not.toContain("as1.tok");
    expect((await ask("/fr/pricing", "kz-session=1")).headers.get("set-cookie") ?? "").toContain("Max-Age=0");
  });
  it("the administration console is not a landing page", async () => {
    expect(goes(await ask("/fr", "akinaza_session=as1.x", "admin.akinaza.com"))).not.toBe("/fr/app");
  });
});

describe("the proxy on the API's writes (ADR-005 slice 1, akinaza#534)", () => {
  const post = (headers: Record<string, string>) => proxy(new NextRequest("https://www.akinaza.com/api/me/profile", { method: "POST", headers: { host: "www.akinaza.com", ...headers } }));

  it("refuses a write from a shop host (same-site) or with the session and no origin, 403", async () => {
    const fromShop = await post({ "sec-fetch-site": "same-site", cookie: "akinaza_session=x" });
    expect(fromShop.status).toBe(403);
    expect((await fromShop.json()).error.code).toBe("CROSS_SITE_WRITE");
    expect((await post({ origin: "https://pattes.akinaza.com" })).status).toBe(403);
    expect((await post({ cookie: "akinaza_session=x" })).status).toBe(403);
  });
  it("lets the app's own writes, a bearer and a cookie-less client through", async () => {
    expect((await post({ "sec-fetch-site": "same-origin", cookie: "akinaza_session=x" })).status).toBe(200);
    expect((await post({ authorization: "Bearer t" })).status).toBe(200);
    expect((await post({})).status).toBe(200);
  });
  it("sets the language cookie host-only, with no Domain", async () => {
    const response = await proxy(new NextRequest("https://www.akinaza.com/fr", { headers: { host: "www.akinaza.com" } }));
    const set = response.headers.get("set-cookie") ?? "";
    expect(set).toMatch(/NEXT_LOCALE=fr/);
    expect(set.toLowerCase()).not.toContain("domain=");
  });
});

/** ADR-005 slice 3 (#535): the proxy sets the policy of each response; the public shop pages get a fresh nonce, on the request too (Next stamps its scripts with it). */
describe("the Content-Security-Policy of the proxy", () => {
  const at = (host: string, path: string) => proxy(new NextRequest(`https://${host}${path}`, { headers: { host } }));
  const scripts = (response: Response) => (response.headers.get("content-security-policy") ?? "").split("; ").find((d) => d.startsWith("script-src "));
  const nonceOf = (response: Response) => /'nonce-([^']+)'/.exec(scripts(response) ?? "")?.[1];

  it("a public shop page carries a nonce policy, the same nonce on the request, and a fresh one each time", async () => {
    const first = await at("www.akinaza.com", "/fr/s/pattes-saint-henri");
    const nonce = nonceOf(first);
    expect(nonce).toBeTruthy();
    expect(scripts(first)).not.toContain("'unsafe-inline'");
    expect(first.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(first.headers.get("x-middleware-request-x-nonce")).toBe(nonce);
    expect(first.headers.get("x-middleware-request-content-security-policy")).toBe(first.headers.get("content-security-policy"));
    expect(nonceOf((await at("www.akinaza.com", "/fr/s/pattes-saint-henri")))).not.toBe(nonce);
  });
  it("a shop's own host is the same page, so the same strict policy", async () => {
    const home = await at("pattes.akinaza.com", "/fr");
    expect(nonceOf(home)).toBeTruthy();
  });
  it("the app and the public pages keep the static policy, with no nonce", async () => {
    for (const path of ["/fr/app", "/fr", "/fr/explore", "/en/pricing"]) {
      const response = await at("www.akinaza.com", path);
      expect(scripts(response), path).toContain("'unsafe-inline'");
      expect(nonceOf(response), path).toBeUndefined();
      expect(response.headers.get("x-middleware-request-x-nonce"), path).toBeNull();
    }
  });
  it("the API has a policy too", async () => {
    expect((await at("www.akinaza.com", "/api/health")).headers.get("content-security-policy")).toContain("default-src 'self'");
  });
  it("drops upgrade-insecure-requests when the declared public origin is plain http, read at request time", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_PUBLIC_URL", "https://www.akinaza.com");
    expect((await at("www.akinaza.com", "/fr/s/x")).headers.get("content-security-policy")).toContain("upgrade-insecure-requests");
    vi.stubEnv("APP_PUBLIC_URL", "http://localhost:3000");
    expect((await at("localhost:3000", "/fr/s/x")).headers.get("content-security-policy")).not.toContain("upgrade-insecure-requests");
  });
});

/** ADR-005 slices 4-5 (akinaza#538, #549): the shop domain, the existence of a shop, the booking hop, the isolation of the session. */
describe("the proxy on the shops' own domain", () => {
  const verdict = vi.mocked(shopVerdict);
  const on = (host: string, path: string, headers: Record<string, string> = {}) => proxy(new NextRequest(`https://${host}${path}`, { headers: { host, ...headers } }));
  const setup = () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_PUBLIC_URL", "https://www.akinaza.com");
    vi.stubEnv("APP_SHOP_DOMAIN", "akinaza.shop");
    verdict.mockResolvedValue({ kind: "shop" } satisfies ShopVerdict);
  };

  it("serves the shop page of a known shop at the root, with its own strict policy: a nonce, form and frame limited to the app", async () => {
    setup();
    const res = await on("salon.akinaza.shop", "/en");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-rewrite")).toBe("https://salon.akinaza.shop/en/s/salon");
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).toContain("form-action 'self' https://www.akinaza.com");
    expect(csp).toContain("frame-ancestors https://www.akinaza.com");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("answers 404, noindex, without the host, to an address that is no shop - before anything is routed", async () => {
    setup();
    verdict.mockResolvedValue({ kind: "none" });
    for (const path of ["/", "/en", "/en/s/ghost", "/robots.txt"]) {
      const res = await on("ghost.akinaza.shop", path);
      expect(res.status, path).toBe(404);
      expect(res.headers.get("x-robots-tag"), path).toBe("noindex, nofollow");
      expect(await res.text(), path).not.toContain("ghost");
    }
    // The legacy address of an unknown shop is a 404 too, not a redirect to a shop that does not exist.
    expect((await on("ghost.akinaza.com", "/")).status).toBe(404);
  });

  it("sends a former address to the shop's current one, 308, keeping the path and the query", async () => {
    setup();
    verdict.mockResolvedValue({ kind: "moved", slug: "salon-neuf" });
    const res = await on("salon.akinaza.shop", "/en/s/salon/service/3?staff=a");
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("https://salon-neuf.akinaza.shop/en/s/salon/service/3?staff=a");
  });

  it("answers a host this deployment does not serve 421 even under the shop domain (a nested label, another domain)", async () => {
    setup();
    for (const host of ["a.b.akinaza.shop", "salon.akinaza.shop.evil.example"]) expect((await on(host, "/en")).status, host).toBe(421);
  });

  it("sends the old addresses to the shop domain with a 308, the query kept: <slug>.akinaza.com and /<locale>/s/<slug> on www", async () => {
    setup();
    const legacy = await on("salon.akinaza.com", "/en?look=b");
    expect([legacy.status, legacy.headers.get("location")]).toEqual([308, "https://salon.akinaza.shop/en?look=b"]);
    const path = await on("www.akinaza.com", "/fr/s/salon?look=b");
    expect([path.status, path.headers.get("location")]).toEqual([308, "https://salon.akinaza.shop/fr?look=b"]);
  });

  it("makes the booking's last step a top-level hop to the app, never served on the shop host", async () => {
    setup();
    const res = await on("salon.akinaza.shop", "/en/s/salon/service/42/confirm?slot=9");
    expect([res.status, res.headers.get("location")]).toEqual([308, "https://www.akinaza.com/en/s/salon/service/42/confirm?slot=9"]);
    // ... and www keeps serving it.
    expect((await on("www.akinaza.com", "/en/s/salon/service/42/confirm")).headers.get("location")).toBeNull();
  });

  it("never shares a session with the shop domain: the app's cookie is not forwarded to the page and no cookie of the app is set there", async () => {
    setup();
    const res = await on("salon.akinaza.shop", "/en", { cookie: "__Host-akinaza_session=tok; akinaza_session=tok; theme=dark" });
    expect(res.headers.get("x-middleware-request-cookie")).toBe("theme=dark");
    const set = res.headers.get("set-cookie") ?? "";
    expect(set).not.toMatch(/session/i);
    expect(set).not.toMatch(/domain=/i);
  });

  it("serves a shop host's robots.txt (closed, with its Sitemap line) and its sitemap, built from configuration", async () => {
    setup();
    const robots = await on("salon.akinaza.shop", "/robots.txt");
    expect(await robots.text()).toBe("User-agent: *\nDisallow: /\nSitemap: https://salon.akinaza.shop/sitemap.xml\n");
    const sitemap = await on("salon.akinaza.shop", "/sitemap.xml");
    expect(sitemap.headers.get("x-middleware-rewrite")).toBe("https://salon.akinaza.shop/api/internal/shop-sitemap");
    expect(sitemap.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("leads the shop domain's apex and www to the app", async () => {
    setup();
    for (const host of ["akinaza.shop", "www.akinaza.shop"]) {
      const res = await on(host, "/whatever");
      expect([res.status, res.headers.get("location")], host).toEqual([308, "https://www.akinaza.com/"]);
    }
  });

  it("lets the internal lookup through on any host, as the health check, and nothing else of the API on a stranger", async () => {
    setup();
    expect((await on("127.0.0.1:3000", "/api/internal/shop-exists?slug=salon")).status).toBe(200);
    expect((await on("127.0.0.1:3000", "/api/internal/shop-sitemap?slug=salon")).status).toBe(421);
  });
});

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { dropCookie } from "./cookie";
import { appOriginOf, isShopDomainRoot, shopDomain, shopHostOf, shopOriginOf, shopPageUrl } from "./shop-domain";
import { shopSitemapXml } from "./shop-sitemap";

const hosted = { APP_PUBLIC_URL: "https://www.akinaza.com", APP_SHOP_DOMAIN: "akinaza.shop" };
const legacy = { APP_PUBLIC_URL: "https://www.akinaza.com" };

/** ADR-005 slice 5 (akinaza#538): shops on their own registrable domain, declared once. */
describe("the shop domain", () => {
  it("is read from APP_SHOP_DOMAIN, lower-cased, and ignored when malformed or unset", () => {
    expect(shopDomain(hosted)).toBe("akinaza.shop");
    expect(shopDomain({ APP_SHOP_DOMAIN: " Akinaza.Shop " })).toBe("akinaza.shop");
    expect(shopDomain({ APP_SHOP_DOMAIN: "https://akinaza.shop" })).toBeNull();
    expect(shopDomain({ APP_SHOP_DOMAIN: "akinaza.shop/x" })).toBeNull();
    expect(shopDomain({ APP_SHOP_DOMAIN: "" })).toBeNull();
    expect(shopDomain({})).toBeNull();
  });

  it("names a shop by <slug>.<shop domain>, and still by the legacy <slug>.<apex>", () => {
    expect(shopHostOf("salon-laurier.akinaza.shop", hosted)).toEqual({ slug: "salon-laurier", own: true });
    expect(shopHostOf("Salon-Laurier.akinaza.shop:443", hosted)).toEqual({ slug: "salon-laurier", own: true });
    expect(shopHostOf("salon-laurier.akinaza.com", hosted)).toEqual({ slug: "salon-laurier", own: false });
    expect(shopHostOf("salon-laurier.akinaza.com", legacy)).toEqual({ slug: "salon-laurier", own: false });
    // Without the declaration, the shop domain names nothing.
    expect(shopHostOf("salon-laurier.akinaza.shop", legacy)).toBeNull();
  });

  it("never names a shop for a platform host, a nested label, a look-alike or the domain itself", () => {
    for (const host of ["www.akinaza.shop", "akinaza.shop", "admin.akinaza.shop", "a.b.akinaza.shop", "ab.akinaza.shop", "bad_slug.akinaza.shop", "akinaza.shop.evil.example", "salon-laurier.akinaza.shop.evil.example", "salon.akinaza.sh", null]) {
      expect(shopHostOf(host, hosted), String(host)).toBeNull();
    }
  });

  it("knows the shop domain's own apex and www: they belong to the app", () => {
    expect(isShopDomainRoot("akinaza.shop", hosted)).toBe(true);
    expect(isShopDomainRoot("WWW.akinaza.shop:443", hosted)).toBe(true);
    expect(isShopDomainRoot("salon-laurier.akinaza.shop", hosted)).toBe(false);
    expect(isShopDomainRoot("akinaza.shop", legacy)).toBe(false);
  });

  it("builds a shop's origin from the configuration only", () => {
    expect(shopOriginOf("salon-laurier", hosted)).toBe("https://salon-laurier.akinaza.shop");
    expect(shopOriginOf("salon-laurier", legacy)).toBe("https://salon-laurier.akinaza.com");
    // A plain-http origin with a port (the CI server) keeps both.
    expect(shopOriginOf("salon-laurier", { APP_PUBLIC_URL: "http://localhost:3000", APP_SHOP_DOMAIN: "shops.localhost" })).toBe("http://salon-laurier.shops.localhost:3000");
    expect(appOriginOf(hosted)).toBe("https://www.akinaza.com");
  });

  it("gives a shop page one canonical address: absolute on the shop domain once declared, the app's path before", () => {
    expect(shopPageUrl("salon-laurier", "fr", hosted)).toBe("https://salon-laurier.akinaza.shop/fr");
    expect(shopPageUrl("salon-laurier", "fr", legacy)).toBe("/fr/s/salon-laurier");
  });
});

describe("what a shop's page may read of the browser's cookies", () => {
  it("drops the named cookies and keeps the others", () => {
    expect(dropCookie("a=1; __Host-akinaza_session=tok; b=2", "__Host-akinaza_session", "akinaza_session")).toBe("a=1; b=2");
    expect(dropCookie("akinaza_session=tok", "akinaza_session")).toBe("");
    expect(dropCookie(null, "akinaza_session")).toBe("");
  });
});

describe("a shop host's sitemap", () => {
  it("lists each language of the shop on its own origin, with the hreflang alternates, escaped", () => {
    const xml = shopSitemapXml("salon-laurier", ["fr", "en"], new Date("2026-10-29T12:00:00Z"), hosted);
    expect(xml).toContain("<loc>https://salon-laurier.akinaza.shop/fr</loc>");
    expect(xml).toContain("<loc>https://salon-laurier.akinaza.shop/en</loc>");
    expect(xml).toContain('hreflang="en" href="https://salon-laurier.akinaza.shop/en"');
    expect(xml).toContain('hreflang="x-default" href="https://salon-laurier.akinaza.shop/fr"');
    expect(xml).not.toContain("www.akinaza.com");
    expect(xml).toContain("<lastmod>2026-10-29T12:00:00.000Z</lastmod>");
  });
});

describe("the deployment spec", () => {
  const spec = readFileSync(new URL("../../../deploy/digitalocean/app.yaml", import.meta.url), "utf8");
  it("declares the shop domain with its wildcard, its www, and the variable the app reads: the three agree", () => {
    expect(spec).toMatch(/- domain: akinaza\.shop\n\s+type: ALIAS\n\s+wildcard: true/);
    expect(spec).toMatch(/- domain: www\.akinaza\.shop\n\s+type: ALIAS/);
    expect(spec).toMatch(/key: APP_SHOP_DOMAIN\n\s+scope: RUN_TIME\n\s+value: akinaza\.shop/);
    expect(shopDomain({ APP_SHOP_DOMAIN: "akinaza.shop" })).toBe("akinaza.shop");
  });
});

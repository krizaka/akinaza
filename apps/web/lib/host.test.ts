import { describe, expect, it } from "vitest";

import { isAdminHost, routeFor } from "./host";

describe("host routing", () => {
  it("serves the console on admin.akinaza.com, and only the console", () => {
    expect(isAdminHost("admin.akinaza.com")).toBe(true);
    expect(isAdminHost("dev.akinaza.com")).toBe(false);
    expect(routeFor("admin.akinaza.com", "/en", "en")).toEqual({ kind: "rewrite", path: "/en/console" });
    expect(routeFor("admin.akinaza.com", "/fr/users/42", "en")).toEqual({ kind: "rewrite", path: "/fr/console/users/42" });
    expect(routeFor("admin.akinaza.com", "/", "fr")).toEqual({ kind: "redirect", path: "/fr" });
    expect(routeFor("admin.akinaza.com", "/en/console/runs", "en")).toEqual({ kind: "redirect", path: "/en/runs" });
  });
  it("keeps the console out of search engines and out of the product site", () => {
    expect(routeFor("admin.akinaza.com", "/robots.txt", "en")).toEqual({ kind: "robotsClosed" });
    expect(routeFor("admin.akinaza.com", "/sitemap.xml", "en")).toEqual({ kind: "notFound" });
    expect(routeFor("dev.akinaza.com", "/en/console", "en")).toEqual({ kind: "notFound" });
    expect(routeFor("dev.akinaza.com", "/fr/console/users", "en")).toEqual({ kind: "notFound" });
  });
  it("leaves the product site as it was", () => {
    expect(routeFor("dev.akinaza.com", "/en/app", "en")).toEqual({ kind: "next" });
    expect(routeFor("dev.akinaza.com", "/", "fr")).toEqual({ kind: "redirect", path: "/fr" });
    expect(routeFor("dev.akinaza.com", "/robots.txt", "en")).toEqual({ kind: "next" });
    expect(routeFor("dev.akinaza.com", "/en/consoles", "en")).toEqual({ kind: "next" });
  });
});

describe("a shop's own subdomain (#77, level 2)", () => {
  const site = "https://www.akinaza.com";
  it("reads the shop from <slug>.akinaza.com, never from a platform host", async () => {
    const { shopOfHost } = await import("./host");
    expect(shopOfHost("pattes-saint-henri.akinaza.com", "akinaza.com")).toBe("pattes-saint-henri");
    expect(shopOfHost("Pattes-Saint-Henri.akinaza.com:443", "akinaza.com")).toBe("pattes-saint-henri");
    for (const h of ["www.akinaza.com", "dev.akinaza.com", "admin.akinaza.com", "api.akinaza.com", "akinaza.com", "a.b.akinaza.com", "ab.akinaza.com", "bad_slug.akinaza.com", "evil.akinaza.com.attacker.io", "salon.yomizaka.com", null]) {
      expect(shopOfHost(h, "akinaza.com"), String(h)).toBeNull();
    }
  });
  it("serves the shop page at the root, keeping the short address", () => {
    expect(routeFor("salon-laurier.akinaza.com", "/", "fr", site)).toEqual({ kind: "rewrite", path: "/fr/s/salon-laurier" });
    expect(routeFor("salon-laurier.akinaza.com", "/en", "fr", site)).toEqual({ kind: "rewrite", path: "/en/s/salon-laurier" });
  });
  it("lets the shop's own journey through, as the page links it", () => {
    expect(routeFor("salon-laurier.akinaza.com", "/fr/s/salon-laurier/service/42/slots", "fr", site)).toEqual({ kind: "next" });
  });
  it("sends everything else to www: another shop, the sign-in, the app", () => {
    expect(routeFor("salon-laurier.akinaza.com", "/fr/s/autre-salon", "fr", site)).toEqual({ kind: "redirect", path: "https://www.akinaza.com/fr/s/autre-salon" });
    expect(routeFor("salon-laurier.akinaza.com", "/fr/sign-in", "fr", site)).toEqual({ kind: "redirect", path: "https://www.akinaza.com/fr/sign-in" });
    expect(routeFor("salon-laurier.akinaza.com", "/robots.txt", "fr", site)).toEqual({ kind: "robotsClosed" });
  });
});

describe("the Spanish shop page (#258)", () => {
  it("serves /es/s/<slug> and nothing else in Spanish: the product's own pages are English and French", () => {
    expect(routeFor("www.akinaza.com", "/es/s/salon-laurier", "fr")).toEqual({ kind: "next" });
    expect(routeFor("www.akinaza.com", "/es/s/salon-laurier/", "fr")).toEqual({ kind: "next" });
    expect(routeFor("www.akinaza.com", "/es/sign-in", "fr")).toEqual({ kind: "redirect", path: "/fr/es/sign-in" });
    expect(routeFor("www.akinaza.com", "/es/app", "en")).toEqual({ kind: "redirect", path: "/en/es/app" });
    expect(routeFor("www.akinaza.com", "/es/s/salon-laurier/service/x", "en")).toEqual({ kind: "redirect", path: "/en/es/s/salon-laurier/service/x" });
  });

  it("a shop's own address answers /es with its page in Spanish", () => {
    const site = "https://www.akinaza.com";
    expect(routeFor("salon-laurier.akinaza.com", "/es", "fr", site)).toEqual({ kind: "rewrite", path: "/es/s/salon-laurier" });
  });
});

/** ADR-005 slice 5 (akinaza#538): shops on their own registrable domain, the old addresses 308 to it, the booking is a hop to the app. */
describe("shops on their own domain", () => {
  const site = "https://www.akinaza.com";
  const hosting = { domain: "akinaza.shop", origin: (slug: string) => `https://${slug}.akinaza.shop` };
  const route = (host: string, path: string) => routeFor(host, path, "fr", site, hosting);

  it("serves the shop page at the root of <slug>.akinaza.shop, in the language of the address", () => {
    expect(route("salon.akinaza.shop", "/")).toEqual({ kind: "rewrite", path: "/fr/s/salon" });
    expect(route("salon.akinaza.shop", "/en")).toEqual({ kind: "rewrite", path: "/en/s/salon" });
    expect(route("salon.akinaza.shop", "/es")).toEqual({ kind: "rewrite", path: "/es/s/salon" });
    expect(route("salon.akinaza.shop", "/en/s/salon")).toEqual({ kind: "next" });
    expect(route("salon.akinaza.shop", "/en/s/salon/service/42")).toEqual({ kind: "next" });
    expect(route("salon.akinaza.shop", "/en/s/salon/service/42/slots")).toEqual({ kind: "next" });
  });

  it("sends the booking's last step and everything of the app to www, 308 (the session never exists on a shop host)", () => {
    for (const path of ["/en/s/salon/service/42/confirm", "/en/s/salon/service/42/confirmation", "/fr/app", "/en/sign-in", "/en/s/other/service/1", "/en/pricing"]) {
      expect(route("salon.akinaza.shop", path), path).toEqual({ kind: "redirect", path: `https://www.akinaza.com${path}`, permanent: true });
    }
  });

  it("closes the shop host's robots.txt and serves its own sitemap", () => {
    expect(route("salon.akinaza.shop", "/robots.txt")).toEqual({ kind: "robotsClosed" });
    expect(route("salon.akinaza.shop", "/sitemap.xml")).toEqual({ kind: "shopSitemap", slug: "salon" });
  });

  it("leads the shop domain's own apex and www to the app", () => {
    for (const host of ["akinaza.shop", "www.akinaza.shop"]) {
      expect(route(host, "/anything")).toEqual({ kind: "redirect", path: "https://www.akinaza.com/", permanent: true });
    }
  });

  it("moves the old addresses to the shop domain with a 308: <slug>.akinaza.com and /<locale>/s/<slug>", () => {
    expect(route("salon.akinaza.com", "/")).toEqual({ kind: "redirect", path: "https://salon.akinaza.shop/", permanent: true });
    expect(route("salon.akinaza.com", "/en/s/salon/service/3")).toEqual({ kind: "redirect", path: "https://salon.akinaza.shop/en/s/salon/service/3", permanent: true });
    expect(route("www.akinaza.com", "/en/s/salon")).toEqual({ kind: "redirect", path: "https://salon.akinaza.shop/en", permanent: true });
    expect(route("www.akinaza.com", "/es/s/salon")).toEqual({ kind: "redirect", path: "https://salon.akinaza.shop/es", permanent: true });
    expect(route("www.akinaza.com", "/fr/s/salon/service/42/slots")).toEqual({ kind: "redirect", path: "https://salon.akinaza.shop/fr/s/salon/service/42/slots", permanent: true });
  });

  it("leaves the booking's hop and the app's pages on www, and the console on its host", () => {
    expect(route("www.akinaza.com", "/en/s/salon/service/42/confirm")).toEqual({ kind: "next" });
    expect(route("www.akinaza.com", "/en/s/salon/service/42/confirmation")).toEqual({ kind: "next" });
    expect(route("www.akinaza.com", "/en/pricing")).toEqual({ kind: "next" });
    expect(route("admin.akinaza.com", "/en/s/salon")).toEqual({ kind: "rewrite", path: "/en/console/s/salon" });
  });

  it("does nothing without a shop domain: the shops stay on <slug>.<apex>", () => {
    expect(routeFor("www.akinaza.com", "/en/s/salon", "fr", site)).toEqual({ kind: "next" });
    expect(routeFor("salon.akinaza.com", "/", "fr", site)).toEqual({ kind: "rewrite", path: "/fr/s/salon" });
  });
});

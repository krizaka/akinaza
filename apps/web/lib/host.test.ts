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
    expect(routeFor("salon-laurier.akinaza.com", "/fr/s/salon-laurier/service/42/creneau", "fr", site)).toEqual({ kind: "next" });
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

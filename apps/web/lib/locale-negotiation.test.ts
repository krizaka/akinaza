import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { LOCALE_HEADER, negotiateLocale, pageLocaleOf } from "./locale-negotiation";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("Loi 96: French by default", () => {
  it("opens in French without cookie or header, or with any French", () => {
    expect(negotiateLocale(undefined, null)).toBe("fr");
    expect(negotiateLocale(undefined, "de-DE")).toBe("fr");
    expect(negotiateLocale(undefined, "en-CA,en;q=0.9,fr-CA;q=0.5")).toBe("fr");
  });
  it("English only when the browser asks for English and never French; the cookie wins", () => {
    expect(negotiateLocale(undefined, "en-US,en;q=0.9")).toBe("en");
    expect(negotiateLocale("en", "fr-CA")).toBe("en");
    expect(negotiateLocale("fr", "en-US")).toBe("fr");
  });
  it("the proxy, the page alternates and the sitemap use it, with x-default on /fr", () => {
    expect(read("proxy.ts")).toMatch(/negotiateLocale\(/);
    expect(read("lib/seo.ts")).toMatch(/"x-default": url\("fr", page\)/);
    expect(read("app/sitemap.ts")).toMatch(/pagePath\("fr", page\)/);
  });
});

describe("the 404 reads the language of the address (krizaka/akinaza#299)", () => {
  it("an address under /fr or /en is that language, whatever the cookie chose", () => {
    expect(pageLocaleOf("/fr/nope", "en")).toBe("fr");
    expect(pageLocaleOf("/en/nope", "fr")).toBe("en");
  });

  it("an address without a language keeps the visitor's choice", () => {
    expect(pageLocaleOf("/nope", "en")).toBe("en");
    expect(LOCALE_HEADER).toBe("x-akinaza-locale");
  });
});

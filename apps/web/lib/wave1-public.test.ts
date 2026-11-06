import { readFileSync } from "node:fs";
import { join } from "node:path";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { generateMetadata } from "@/app/[locale]/layout";
import robots from "@/app/robots";
import { bindProduct } from "@/lib/brand";
import enRaw from "@/messages/en.json";
import frRaw from "@/messages/fr.json";

import { proxy } from "../proxy";
import { indexableOn, isCodeNameHost } from "./indexing";
import { HOME_SECTIONS, productStatus } from "./landing";
import { llmsText } from "./seo";

/** Wave 1 of the public-pages meeting (2026-11-05, krizaka-internal#2630): the paused Folioviv site is closed to search engines, shows no price and says one status. */

const en = bindProduct(enRaw);
const fr = bindProduct(frRaw);
const ROOT = join(__dirname, "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const words = (node: unknown): string[] => {
  if (typeof node === "string") {return [node];}
  if (node && typeof node === "object") {return Object.values(node).flatMap(words);}
  return [];
};

// The fonts are `next/font/local` calls, resolved by the Next compiler only.
vi.mock("@/lib/shop-fonts", () => ({ shopSans: { variable: "" }, shopDisplay: { variable: "" } }));
vi.mock("./shop-directory", async (original) => ({ ...(await original<typeof import("./shop-directory")>()), shopVerdict: vi.fn(async () => ({ kind: "shop" })), customHostVerdict: vi.fn(async () => ({ kind: "none" })) }));

beforeEach(() => vi.stubEnv("APP_ALLOWED_HOSTS", "www.akinaza.com"));
afterEach(() => vi.unstubAllEnvs());

describe("www.akinaza.com is a code-name host: closed to search engines whatever the configuration says", () => {
  it("knows the code-name hosts", () => {
    for (const host of ["www.akinaza.com", "WWW.akinaza.com:443", "akinaza.com", "www.yomizaka.com", "www.orazaka.com"]) { expect(`${host} ${isCodeNameHost(host)}`).toBe(`${host} true`); }
    for (const host of ["www.folioviv.com", "www.krizaka.com", "", null, undefined]) { expect(`${host} ${isCodeNameHost(host)}`).toBe(`${host} false`); }
  });

  it("is not indexable even with APP_SEARCH_INDEXING on, or when it is the public address", () => {
    for (const env of [{}, { APP_SEARCH_INDEXING: "on" }, { APP_SEARCH_INDEXING: "off", APP_PUBLIC_URL: "https://www.akinaza.com" }]) { expect(indexableOn("www.akinaza.com", env)).toBe(false); }
    expect(indexableOn("www.folioviv.com", {})).toBe(true);
  });

  it("every answer says noindex, robots.txt disallows everything", async () => {
    const www = (path: string) => proxy(new NextRequest(`https://www.akinaza.com${path}`, { headers: { host: "www.akinaza.com" } }));
    for (const path of ["/fr", "/en", "/fr/pricing", "/en/sign-in", "/api/healthz"]) { expect(`${path} ${(await www(path)).headers.get("x-robots-tag")}`).toBe(`${path} noindex, nofollow`); }
    const res = await www("/robots.txt");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(await res.text()).toMatch(/^User-agent: \*\nDisallow: \/\n/);
  });

  it("robots.ts (the file the build writes) disallows everything for every crawler", () => {
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(rule.disallow).toBe("/");
      expect(rule.allow).toBeUndefined();
    }
  });

  it("the pages say noindex in their <head> (the locale layout)", async () => {
    for (const locale of ["fr", "en"]) {
      const meta = await generateMetadata({ params: Promise.resolve({ locale }) });
      expect(meta.robots).toMatchObject({ index: false, follow: false });
    }
  });
});

describe("no price anywhere public: the pages that show a price are gone from the public face", () => {
  it("the home does not mount the founder offer and has no offer section", () => {
    expect(read("app/[locale]/page.tsx")).not.toMatch(/FounderOffer|price-catalogue|founder-offer/);
    expect(HOME_SECTIONS).toEqual(["hero", "screens", "trust"]);
  });

  it("the public pricing page reads no catalogue and no plan: it says access is by invitation", () => {
    const page = read("app/[locale]/pricing/page.tsx");
    expect(page).not.toMatch(/price-catalogue|pricing-view|founder-offer|PricingPage|billing/);
    expect(page).toContain("contactHref");
    for (const m of [fr, en]) {
      expect(m.pricing.access.title).toBeTruthy();
      expect(m.pricing.access.cta).toBeTruthy();
    }
    expect(fr.pricing.access.lead).toBe("Accès sur invitation : écrivez-nous.");
    expect(en.pricing.access.lead).toBe("Access by invitation: write to us.");
  });

  it("no amount, no fee and no percentage in the words a visitor reads (home, pricing invitation, meta, terms, privacy, llms.txt)", () => {
    const AMOUNT = /\d[\d\s.,]*\s?\$|\$\s?\d|\b\d+\s?(CAD|USD)\b|par mois|per month|\/\s?mois|\/\s?month|cardRate|debitRate|debitCap|\{price\}/i;
    const FEES = /frais\b.*(carte|débit)|(card|debit).*\bfees?\b/i;
    for (const m of [fr, en]) {
      // The founder offer's words wait, unmounted, for the day the product resumes: the rest of the landing is what a visitor reads.
      const landing = Object.fromEntries(Object.entries(m.landing).filter(([key]) => key !== "founder"));
      for (const text of [...words(landing), ...words(m.pricing.access), ...words(m.meta)]) {
        expect(text).not.toMatch(AMOUNT);
        expect(text).not.toMatch(FEES);
      }
      // The terms still say who pays whom, but name no amount.
      for (const text of [...words(m.terms), ...words(m.privacy)]) { expect(text).not.toMatch(AMOUNT); }
    }
    expect(llmsText()).not.toMatch(/\d\s?\$|\$\s?\d/);
  });

  it("the terms point to no pricing page", () => {
    for (const m of [fr, en]) { expect(JSON.stringify(m.terms)).not.toMatch(/page des tarifs|pricing page/i); }
  });
});

describe("one status, the same word everywhere: paused", () => {
  it("the product is paused, whatever its dev-preview checklist says", () => {
    expect(productStatus({ criteria: { a: { na: "x" }, b: { evidence: "https://x" } } })).toBe("paused");
    expect(productStatus({ criteria: { a: { evidence: null } } })).toBe("paused");
  });

  it("En pause / Paused", () => {
    expect(fr.landing.status.paused).toMatch(/^En pause/);
    expect(en.landing.status.paused).toMatch(/^Paused/);
  });
});

describe("the line is « taxes préparées », never « réglées »; the host is not on screen", () => {
  it("the title, the lead and the description", () => {
    expect(fr.landing.title).toBe("Vos rendez-vous et vos factures réglés, vos taxes préparées.");
    expect(en.landing.title).toBe("Your bookings and invoices sorted, your taxes prepared.");
    for (const text of [fr.landing.title, fr.landing.lead, fr.meta.description]) { expect(text).not.toMatch(/taxes?[^.]{0,20}réglé/i); }
    for (const text of [en.landing.title, en.landing.lead, en.meta.description]) { expect(text).not.toMatch(/taxes?,? sorted/i); }
    expect(fr.meta.description).toMatch(/taxes préparées/);
    expect(en.meta.description).toMatch(/taxes prepared/);
  });

  it("the phone's label is the product's name, not its host", () => {
    for (const m of [fr, en]) { expect(m.landing.visualLabel).not.toMatch(/akinaza|www\.|\.com/i); }
  });

  it("no code name in the words of the public face (a host is a link, never a label)", () => {
    for (const m of [fr, en]) { for (const text of [...words(m.landing), ...words(m.meta), ...words(m.pricing.access)]) {
        expect(text).not.toMatch(/akinaza/i);
      }
    }
  });
});

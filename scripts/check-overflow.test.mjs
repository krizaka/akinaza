import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { FRAME_LOCALES, FRAME_PAGES, judge, PAGES, THEMES, WIDTHS } from "./check-overflow.mjs";

describe("the dev-preview crawl (ui.themes-devices)", () => {
  it("covers both languages of the public pages and the sign-in, in both themes, from a phone to a desktop", () => {
    for (const page of ["/en", "/fr", "/en/sign-in", "/fr/sign-in", "/en/changelog", "/fr/privacy", "/fr/s/cedre-ciseaux?look=editorial", "/en/s/pattes-saint-henri?look=journal"]) expect(PAGES).toContain(page);
    expect(THEMES).toEqual(["dark", "light"]);
    expect(Math.min(...WIDTHS)).toBeLessThanOrEqual(360);
    expect(Math.max(...WIDTHS)).toBeGreaterThanOrEqual(1440);
  });

  it("refuses a console error, an uncaught exception, an HTTP error and an empty page", () => {
    const source = readFileSync(new URL("./check-overflow.mjs", import.meta.url), "utf8");
    for (const needle of ['page.on("console"', 'page.on("pageerror"', "response.status() >= 400", "empty <main>"]) expect(source).toContain(needle);
  });

  it("waits for the page to load, never for the network to go quiet: the home's looping video never does (akinaza#341)", () => {
    const source = readFileSync(new URL("./check-overflow.mjs", import.meta.url), "utf8");
    expect(source).not.toContain('"networkidle"');
    expect(source).toContain('waitUntil: "load"');
  });

  it("also holds the signed-in frame to it (akinaza#396): the owner's rail, header and account menu on the pages of the day, in both languages and themes", () => {
    for (const page of ["/aujourdhui", "/clients", "/invoices", "/books", "/shop"]) expect(FRAME_PAGES).toContain(page);
    expect(FRAME_LOCALES).toEqual(["fr", "en"]);
    const source = readFileSync(new URL("./check-overflow.mjs", import.meta.url), "utf8");
    expect(source).toContain("/api/auth/sign-in");
  });

  it("refuses a site bar that overlaps the development notice (akinaza#440), and accepts one that clears it", () => {
    const page = { scroll: 390, client: 390, wide: [], actions: [44] };
    expect(judge({ ...page, chrome: { noticeBottom: 56, barTop: 12 } }, "/en @390 dark")).toEqual([expect.stringContaining("overlaps the development notice")]);
    expect(judge({ ...page, chrome: { noticeBottom: 56, barTop: 68 } }, "/en @390 dark")).toEqual([]);
    expect(judge({ ...page, chrome: null }, "/en @390 dark")).toEqual([]);
  });
});

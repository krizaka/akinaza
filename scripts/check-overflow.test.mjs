import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { PAGES, THEMES, WIDTHS } from "./check-overflow.mjs";

describe("the dev-preview crawl (ui.themes-devices)", () => {
  it("covers both languages of the public pages and the sign-in, in both themes, from a phone to a desktop", () => {
    for (const page of ["/en", "/fr", "/en/sign-in", "/fr/sign-in", "/en/changelog", "/fr/privacy"]) expect(PAGES).toContain(page);
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
});

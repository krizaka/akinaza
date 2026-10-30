import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { A11Y, A11Y_WIDTHS, CHECKS, FRAME_LOCALES, FRAME_PAGES, OPTIONS, PAGES, SETTLE_MS, STATE_OWNERS, THEMES, TILE_PATH, WIDTHS, launchWithStubbedTiles, stubTiles } from "./check-overflow.mjs";

describe("the dev-preview crawl (ui.themes-devices)", () => {
  it("covers both languages of the public pages and the sign-in, in both themes, from a phone to a desktop", () => {
    for (const page of ["/en", "/fr", "/en/sign-in", "/fr/sign-in", "/en/changelog", "/fr/privacy", "/fr/s/cedre-ciseaux?look=editorial", "/en/s/pattes-saint-henri?look=journal"]) expect(PAGES).toContain(page);
    expect(THEMES).toEqual(["dark", "light"]);
    expect(Math.min(...WIDTHS)).toBeLessThanOrEqual(360);
    expect(Math.max(...WIDTHS)).toBeGreaterThanOrEqual(1440);
  });

  it("refuses a console error, an uncaught exception, an HTTP error and an empty page: the shared audit, every console error counted", () => {
    expect(CHECKS).toMatchObject({ status: true, emptyMain: true });
    // `ignoreConsole: []`: a failed first-party request is a console error too, as before the shared audit.
    expect(OPTIONS.ignoreConsole).toEqual([]);
  });

  it("waits for the page to load, never for the network to go quiet: the home's looping video never does (akinaza#341)", () => {
    const source = readFileSync(new URL("./check-overflow.mjs", import.meta.url), "utf8");
    expect(source).not.toContain('"networkidle"');
    expect(source).toContain('waitUntil: "load"');
    expect(OPTIONS.settleMs).toBe(SETTLE_MS);
  });

  it("also holds the signed-in frame to it (akinaza#396): the owner's rail, header and account menu on the pages of the day, in both languages and themes", () => {
    for (const page of ["/today", "/clients", "/invoices", "/books", "/shop"]) expect(FRAME_PAGES).toContain(page);
    expect(FRAME_LOCALES).toEqual(["fr", "en"]);
    const source = readFileSync(new URL("./check-overflow.mjs", import.meta.url), "utf8");
    expect(source).toContain("/api/auth/sign-in");
  });

  it("holds the signed-in frame to a screen that fits under the notice (akinaza#444), and an action to 36 px; the bar over the notice (akinaza#440) is the audit's top-chrome check", () => {
    expect(CHECKS).toMatchObject({ frame: true, minAction: 36 });
    expect(OPTIONS.height).toBe(900);
  });

  it("keeps the axe ratchet per repo: a11y-baseline.json, at the phone and the desktop width", () => {
    expect(A11Y).toMatchObject({ app: "akinaza", widths: A11Y_WIDTHS });
    expect(A11Y.baseline).toMatch(/a11y-baseline\.json$/);
    expect(A11Y_WIDTHS).toEqual([390, 1440]);
  });

  it("takes the notice off the frame's screen in CSS, from the height FrameSlot measures", () => {
    const css = readFileSync(new URL("../apps/web/app/globals.css", import.meta.url), "utf8");
    expect(css).toMatch(/\[data-app-frame-slot\] > \.min-h-dvh \{ min-height: calc\(100dvh - var\(--kz-top-chrome-h, 0px\)\)/);
    expect(css).toMatch(/\.md\\:h-dvh \{ height: calc\(100dvh - var\(--kz-top-chrome-h/);
    for (const f of ["ShopFrame", "AppFrame"]) expect(readFileSync(new URL(`../apps/web/components/app/${f}.tsx`, import.meta.url), "utf8")).toContain("<FrameSlot>");
  });

  it("crawls the frame as an owner with an EMPTY shop and an owner with ONE item per list, seeded by CI like the dev seed (akinaza#405)", () => {
    expect(STATE_OWNERS.map((o) => o.state)).toEqual(["empty", "one"]);
    const ci = readFileSync(new URL("./ci-after-build.sh", import.meta.url), "utf8");
    expect(ci).toContain("scripts/seed-owner-states.mjs");
    for (const o of STATE_OWNERS) expect(ci).toContain(`${o.emailVariable}=`);
    expect(readFileSync(new URL("../apps/web/scripts/seed-cast.mjs", import.meta.url), "utf8")).toContain("ensureOwnerStates(");
  });

  it("never asks the media CDN for the basemap: tile and glyph requests are answered by the audit itself (akinaza#625)", async () => {
    expect(OPTIONS.launch).toBe(launchWithStubbedTiles);
    expect(TILE_PATH.test("/maps/v1/glyphs/Noto/0-255.pbf")).toBe(true);
    expect(TILE_PATH.test("/fr/s/pattes-saint-henri")).toBe(false);
    let matcher;
    let handler;
    await stubTiles({ route: async (m, h) => ((matcher = m), (handler = h)) });
    expect(matcher(new URL("http://localhost:3000/maps/v1/basemap.pmtiles"))).toBe(true);
    expect(matcher(new URL("http://localhost:3000/fr/s/pattes-saint-henri"))).toBe(false);
    let answer;
    await handler({ fulfill: async (a) => (answer = a) });
    expect(answer).toMatchObject({ status: 200, body: "" });
  });
});

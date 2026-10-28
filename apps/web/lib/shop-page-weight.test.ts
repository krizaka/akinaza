import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * What keeps a shop's public page light and still (ADR-004, akinaza#459, #460): the budgets themselves are measured in CI (`scripts/check-perf-budgets.mjs`);
 * these hold the causes that were found, so a change that brings one back fails here, before the measure.
 */
const read = (path: string) => readFileSync(join(__dirname, "..", path), "utf8");
const SHOP = "app/[locale]/s/[slug]/(public)";

describe("a shop's public page paints its first screen at once", () => {
  it("streams no skeleton in front of the page: the hero is in the first chunk with its image preload, and nothing swaps in after it (CLS)", () => {
    expect(existsSync(join(__dirname, "..", SHOP, "loading.tsx"))).toBe(false);
    // The booking steps keep theirs.
    expect(existsSync(join(__dirname, "..", SHOP, "service/loading.tsx"))).toBe(true);
  });

  it("preloads the cover with a high priority, from the server render", () => {
    const view = read("components/shop/ShopPageView.tsx");
    expect(view).toMatch(/preload\(plan\.cover\.src, \{ as: "image", fetchPriority: "high", imageSrcSet: phone, imageSizes: "100vw", media: PHONE_MEDIA \}\)/);
    expect(view.startsWith('"use client"')).toBe(false);
  });
});

describe("the bar ships no catalogue and no session code to a visitor with no session", () => {
  it("the client bar receives its words: no dictionary reaches the browser", () => {
    const bar = read("components/SiteChrome.tsx");
    expect(bar).not.toMatch(/import \{[^}]*\b(translator|getDictionary|i18n)\b[^}]*\} from "@\/lib\/i18n"/);
    expect(bar).not.toContain("BarSession");
  });

  it("the page reads the session cookie and says `anonymous`: the bar is then the signed-out one, without the account island", () => {
    const page = read(`${SHOP}/page.tsx`);
    expect(page).toContain("SESSION_COOKIE");
    expect(page).toContain("anonymous={anonymous}");
    const header = read("components/SiteHeader.tsx");
    expect(header).toMatch(/anonymous \? <SignedOutActions/);
  });

  it("the account island (query client, `/api/me` schema, account menu) is a chunk of its own, asked for once the page has loaded", () => {
    const lazy = read("components/account/LazyBarSession.tsx");
    expect(lazy).toContain('import("@/components/account/BarSession")');
    expect(lazy).toContain('"load"');
    expect(lazy).not.toMatch(/^import \{ BarSession/m);
  });

  it("the realtime island is mounted only when the setting is on", () => {
    expect(read(`${SHOP}/page.tsx`)).toMatch(/\{live \? <StorefrontLive/);
  });
});

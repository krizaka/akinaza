import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { pagePath,PAGES } from "./site";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");
const view = read("components/explore/ExploreView.tsx");
const map = read("components/explore/ExploreMap.tsx");
const root = join(__dirname, "../../..");

describe("Explorer is a public page (akinaza#235)", () => {
  it("is in the public pages: sitemap, hreflang and the title come from the same list", () => {
    expect(PAGES).toContain("explore");
    expect(pagePath("fr", "explore")).toBe("/fr/explore");
    expect(read("lib/seo.ts")).toContain('page === "explore"');
  });

  it("is in the crawl that audits every public page in both themes, both languages and every width (check-overflow, axe)", () => {
    const audit = readFileSync(join(root, "scripts/check-overflow.mjs"), "utf8");
    expect(audit).toMatch(/"\/en\/explore", "\/fr\/explore"/);
  });

  it("is a server page with the shared bar, the shared footer and its words said on the server", () => {
    const page = read("app/[locale]/explore/page.tsx");
    expect(page).toContain("<SiteHeader");
    expect(page).toContain("<SiteFooter");
    expect(page).toContain("getDictionary(locale).explore");
    expect(page.startsWith('"use client"')).toBe(false);
  });
});

describe("the map is lazy and the position is never kept", () => {
  it("loads the map as its own chunk, only when it is shown (list first on a phone)", () => {
    expect(view).toMatch(/dynamic\(\(\) => import\("\.\/ExploreMap"\), \{ ssr: false/);
    expect(view).not.toMatch(/from "@krizaka\/ui\/map"|maplibre/);
    expect(view).toContain('wide || view === "map"');
    expect(map).toContain('from "@krizaka/ui/map"');
  });

  it("asks for the position only on a click: no geolocation on load, no storage, no request carrying it", () => {
    const locates = [...view.matchAll(/geolocation\.getCurrentPosition/g)];
    expect(locates).toHaveLength(1);
    expect(view).not.toMatch(/localStorage|sessionStorage|document\.cookie|useEffect|watchPosition/);
    // The position stays in state: the only requests are the shops list and the typed query.
    expect(view).not.toMatch(/coords\.(latitude|longitude)[^\n]*(fetch|krizakaFetch)/);
  });

  it("holds no word and no locale ternary: every string is a message", () => {
    expect(view).not.toMatch(/locale === "(fr|en)"/);
    expect(map).not.toMatch(/locale === "(fr|en)"/);
  });
});

describe("the catalogues say every word of the page in both languages", () => {
  const en = JSON.parse(read("messages/en.json"));
  const fr = JSON.parse(read("messages/fr.json"));
  it("has the same keys, and « Explorer » in the bar", () => {
    const keys = (o: unknown, p = ""): string[] => (o && typeof o === "object" ? Object.entries(o).flatMap(([k, v]) => keys(v, `${p}.${k}`)) : [p]);
    expect(keys(fr.explore)).toEqual(keys(en.explore));
    expect(en.chrome.explore).toBe("Explorer");
    expect(fr.chrome.explore).toBe("Explorer");
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";


const chrome = readFileSync(join(__dirname, "../components/SiteChrome.tsx"), "utf8");

describe("the bar's composition (NavBar of @krizaka/ui, 3.30)", () => {
  it("shows the family's flat links (publicBarLinks: Pricing, Docs), four at most, no hand-written menu", () => {
    expect(chrome).toContain("publicBarLinks(");
    expect(chrome).toContain("<NavBar.Link");
    expect(chrome).not.toContain("<NavBar.Menu");
    const slots = [...chrome.matchAll(/(pricing|docs|howItWorks|download): pagePath/g)];
    expect(slots.length).toBeLessThanOrEqual(4);
  });

  it("is built from the family's pieces: the one language switch, the phone panel, no hand-made bar", () => {
    expect(chrome).toContain("NavBar.Language");
    expect(chrome).toContain("NavBar.Mobile");
    expect(chrome).not.toMatch(/NavBar\.Family|NavBar\.Badge/);
  });
});

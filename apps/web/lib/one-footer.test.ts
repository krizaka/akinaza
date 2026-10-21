import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// One footer, one band (Oussama, 2026-10-21): the family's SiteFooter in product mode, rendered once per public page, after
// its <main>; the signed-in spaces ((app), (admin)) have their shell and no footer; no dev strip under it.
const ROOT = join(__dirname, "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
function files(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    return statSync(join(ROOT, rel)).isDirectory() ? files(rel) : [rel];
  });
}

describe("the pages render exactly one footer", () => {
  it("the footer is the family's SiteFooter without family columns, the notice is inside it", () => {
    const footer = read("components/SiteFooter.tsx");
    expect(footer).toContain('from "@krizaka/ui/site-footer"');
    expect(footer).toContain("family={false}");
    expect(footer).not.toMatch(/<footer\b/);
    expect(footer).toContain("legal={");
    expect(footer).toContain('t("chrome.devNotice")');
  });

  it("a page that renders <SiteFooter/> renders it once, after its main; the signed-in spaces render none", () => {
    const all = files("app").filter((f) => /\.tsx$/.test(f));
    const withFooter = all.filter((f) => /<SiteFooter\b/.test(read(f)));
    expect(withFooter.length).toBeGreaterThan(0);
    for (const f of withFooter) {
      const source = read(f);
      expect(source.match(/<SiteFooter\b/g), f).toHaveLength(1);
      if (source.includes("</main>")) expect(source.lastIndexOf("</main>"), f).toBeLessThan(source.indexOf("<SiteFooter"));
    }
    expect(withFooter.filter((f) => /\/\((app|admin)\)\//.test(f))).toEqual([]);
  });

  it("nothing else draws a footer-like band", () => {
    const offenders = [...files("app"), ...files("components")]
      .filter((f) => /\.tsx$/.test(f) && !/components\/SiteFooter\.tsx$/.test(f))
      .filter((f) => /<footer\b|<FamilyFooter\b|dev-environment-notice/.test(read(f)));
    expect(offenders).toEqual([]);
  });

  it("the development notice says it without an em dash (Cahier)", () => {
    for (const l of ["en", "fr"]) expect(read(`messages/${l}.json`)).not.toMatch(/"devNotice": "[^"]*—/);
  });
});

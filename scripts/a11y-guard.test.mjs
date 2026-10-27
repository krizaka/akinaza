import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// The accessibility guard (a bug means a missing guard; akinaza#445 left « contrast not measured »): axe-core WCAG 2.1 AA in the
// dev-preview crawl, held by a ratchet baseline that only goes down.
const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), "utf8");

describe("the a11y guard", () => {
  it("the crawl runs axe through @krizaka/a11y-audit (never axe-core itself) and ratchets against a11y-baseline.json", () => {
    const source = read("scripts/check-overflow.mjs");
    expect(source).toContain('from "@krizaka/a11y-audit"');
    expect(source).toContain("auditA11y(page)");
    expect(source).toContain("a11y-baseline.json");
    expect(source).not.toContain('from "axe-core"');
  });

  it("a11y-baseline.json holds counts, and no serious or critical rule (those are fixed, not recorded)", () => {
    const { rules } = JSON.parse(read("a11y-baseline.json"));
    for (const [rule, { impact, count }] of Object.entries(rules)) {
      expect(Number.isInteger(count) && count > 0, `${rule}: a positive count`).toBe(true);
      expect(["minor", "moderate"], `${rule} is ${impact}: fix it, do not record it`).toContain(impact);
    }
  });
});

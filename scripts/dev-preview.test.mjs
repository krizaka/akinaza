import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("dev-preview.json", () => {
  const { criteria } = JSON.parse(read("dev-preview.json"));

  it("declares the mobile criteria na only while AGENTS.md says there is no mobile app", () => {
    const na = ["mobile.build", "mobile.ux-review", "mobile.app-links"].filter((k) => criteria[k]?.na);
    if (na.length) expect(read("AGENTS.md")).toMatch(/No mobile app in the dev preview/);
  });

  it("gives every criterion either evidence, a justified na, or a gap with its issue", () => {
    for (const [id, c] of Object.entries(criteria)) {
      const ok = c.evidence || c.na || (c.gap && c.issue);
      expect(ok, id).toBeTruthy();
    }
  });
});

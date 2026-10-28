import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

// Bunny layout v2 (ADR-014, krizaka/.github#368): this site reads `sites/akinaza/`, `apps/akinaza/defaults/` and `org/v1/maps/`.
// The legacy `site/…` and `/maps/v1` zone paths are deleted once released, so nothing here may name them again.
const REPO = join(__dirname, "../../..");
const ROOTS = ["apps/web", "packages", "deploy"];
const SKIP = new Set(["node_modules", ".next", ".turbo", "coverage", "dist"]);
const LEGACY = /b-cdn\.net\/site\/|b-cdn\.net\/maps\/v1|site\/products\/|"root":\s*"site"/;

function* files(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.(ts|tsx|mjs|json|ya?ml)$/.test(name) && !name.endsWith("media-layout.test.ts")) yield path;
  }
}

describe("media paths are Bunny layout v2", () => {
  it("no source file names a legacy zone path (site/…, maps/v1 on the zone)", () => {
    const hits = ROOTS.flatMap((r) => [...files(join(REPO, r))]).filter((f) => LEGACY.test(readFileSync(f, "utf8"))).map((f) => relative(REPO, f));
    expect(hits).toEqual([]);
  });
});

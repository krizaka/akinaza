import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * The client boundary (found on D5/D6): a Server Component that imports a value — a function, a table, a constant — from a
 * `"use client"` module gets a client reference, not the value. Calling it throws (« Attempted to call … from the server »);
 * reading it gives `undefined` (an invoice's state chip lost its tone). A server file may import components and types from a
 * client module, nothing else: shared values live in a module without `"use client"` (`lib/`).
 */
const WEB = fileURLToPath(new URL("..", import.meta.url));
const SOURCES = ["app", "components", "lib"].flatMap((dir) =>
  (readdirSync(join(WEB, dir), { recursive: true }) as string[]).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f)).map((f) => join(WEB, dir, f)),
);
/** The file opens with `"use client"`, after any comments (read without a backtracking pattern). */
const isClient = (file: string) => {
  let rest = readFileSync(file, "utf8").trimStart();
  for (;;) {
    const close = rest.startsWith("//") ? "\n" : rest.startsWith("/*") ? "*/" : null;
    if (close === null) break;
    const at = rest.indexOf(close);
    if (at < 0) return false;
    rest = rest.slice(at + close.length).trimStart();
  }
  return /^["']use client["']/.test(rest);
};
const resolve = (spec: string, from: string) => {
  const base = spec.startsWith("@/") ? join(WEB, spec.slice(2)) : spec.startsWith(".") ? normalize(join(dirname(from), spec)) : null;
  return base ? [".tsx", ".ts", "/index.tsx", "/index.ts"].map((ext) => base + ext).find(existsSync) : undefined;
};
/** A React component's name (PascalCase), not a constant's (`STATE_TONE`). */
const isComponent = (name: string) => /^[A-Z]/.test(name) && !/^[A-Z][A-Z0-9_]+$/.test(name);

export function boundaryViolations(files: readonly string[]): string[] {
  const found: string[] = [];
  for (const file of files.filter((f) => !isClient(f))) {
    for (const m of readFileSync(file, "utf8").matchAll(/import\s+(type\s+)?\{([^}]*)\}\s+from\s+["']([^"']+)["']/g)) {
      const target = m[1] ? undefined : resolve(m[3]!, file);
      if (!target || !isClient(target)) continue;
      for (const raw of m[2]!.split(",").map((n) => n.trim()).filter((n) => n && !n.startsWith("type "))) {
        const name = raw.split(/\s+as\s+/)[0]!;
        if (!isComponent(name)) found.push(`${relative(WEB, file)} imports ${name} from the client module ${m[3]}`);
      }
    }
  }
  return found;
}

describe("the rule itself (a rule-test): it sees a value crossing the boundary", () => {
  it("flags a constant and a function a server file imports from a client module, not a component or a type", () => {
    const dir = mkdtempSync(join(tmpdir(), "boundary-"));
    writeFileSync(join(dir, "client.tsx"), '// a comment\n"use client";\nexport const TONE = {};\nexport const readTab = () => 1;\nexport function Panel() { return null; }\n');
    writeFileSync(join(dir, "server.tsx"), 'import { Panel, readTab, TONE, type Other } from "./client";\n');
    expect(boundaryViolations([join(dir, "server.tsx")]).map((v) => v.split(" imports ")[1]!.split(" ")[0])).toEqual(["readTab", "TONE"]);
  });
});

describe("the client boundary: a server file takes only components and types from a « use client » module", () => {
  it("holds across app/, components/ and lib/", () => {
    expect(boundaryViolations(SOURCES)).toEqual([]);
  });
});

describe("the org registry stays out of the browser bundle (client JS budget)", () => {
  it("no « use client » module imports lib/brand: the server passes the commercial name down", () => {
    const offenders = SOURCES.filter((f) => isClient(f) && /from\s+["'](@\/lib\/brand|\.\/brand)["']/.test(readFileSync(f, "utf8"))).map((f) => relative(WEB, f));
    expect(offenders).toEqual([]);
  });
});

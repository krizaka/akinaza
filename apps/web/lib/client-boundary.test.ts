import { existsSync, readdirSync, readFileSync } from "node:fs";
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
const isClient = (file: string) => /^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*\s*["']use client["']/.test(readFileSync(file, "utf8"));
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

describe("the client boundary: a server file takes only components and types from a « use client » module", () => {
  it("holds across app/, components/ and lib/", () => {
    expect(boundaryViolations(SOURCES)).toEqual([]);
  });
});

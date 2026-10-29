import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/** The guard of the pages' clock: ast-grep's `no-ambient-clock` only reads lib/ and packages/, so this one reads every server page and route. */
const ROOT = join(__dirname);
const ALLOWED = new Set(["system-clock.ts"]);

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !ALLOWED.has(name) ? [path] : [];
  });
}

describe("app pages and routes", () => {
  it("never read the wall clock themselves: requestNow() or an injected clock", () => {
    const offenders = sources(ROOT).filter((file) => {
      const text = readFileSync(file, "utf8");
      return !text.startsWith('"use client"') && /new Date\(\)|Date\.now\(\)/.test(text) && !/request-now/.test(file);
    });
    expect(offenders.map((f) => f.slice(ROOT.length))).toEqual([]);
  });
});

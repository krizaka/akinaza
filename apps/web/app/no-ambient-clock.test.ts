import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/** The guard of the pages' clock: ast-grep's `no-ambient-clock` only reads lib/ and packages/, so this one reads every server page and route. */
const ROOT = join(__dirname);
const ALLOWED = new Set(["system-clock.ts"]);

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {return sources(path);}
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

/** The pages of the visual journeys (walker-today…) are drawn at the run's fixed instant (APP_FIXED_NOW): nothing they render reads the server's clock. */
describe("the server code behind a visual-journey page", () => {
  const WEB = join(__dirname, "..");
  const FILES = ["lib/today.ts", "lib/day.ts", "lib/figures.ts", "lib/brief.ts", "components/app/SpaceChrome.tsx", "components/app/TodayDay.tsx", "components/app/WalkerDay.tsx", "components/app/TodayFigures.tsx"];
  it("reads no wall clock (new Date(), Date.now(), SQL now()) — the instant arrives from requestNow()", () => {
    const offenders = FILES.filter((file) => /new Date\(\)|Date\.now\(\)|\bnow\(\)\s+AT\s+TIME|[^.\w]now\(\)(?!\))/i.test(readFileSync(join(WEB, file), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")));
    expect(offenders).toEqual([]);
  });
});

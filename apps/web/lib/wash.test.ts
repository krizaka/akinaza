import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { changedKeys, signaturesOf } from "./wash";

const rows = (...pairs: [string, string][]) => pairs.map(([id, state]) => ({ id, state }));
const sign = (r: { id: string; state: string }) => r.state;

describe("a changed row washes once (D11)", () => {
  it("washes nothing on page arrival", () => {
    expect(changedKeys(null, rows(["a", "due"], ["b", "paid"]), (r) => r.id, sign)).toEqual(new Set());
  });

  it("washes the rows whose content changed, and the rows that arrived, after the page read again", () => {
    const before = signaturesOf(rows(["a", "due"], ["b", "due"]), (r) => r.id, sign);
    expect(changedKeys(before, rows(["a", "paid"], ["b", "due"], ["c", "due"]), (r) => r.id, sign)).toEqual(new Set(["a", "c"]));
  });

  it("one wash per change: the same rows read again wash nothing", () => {
    const now = rows(["a", "paid"]);
    expect(changedKeys(signaturesOf(now, (r) => r.id, sign), now, (r) => r.id, sign)).toEqual(new Set());
  });
});

/** The stylesheets that draw the wash: @krizaka/ui's motion.css and the product's one local rule (globals.css). */
const MOTION = readFileSync(createRequire(import.meta.url).resolve("@krizaka/ui/motion.css"), "utf8");
const GLOBALS = readFileSync(fileURLToPath(new URL("../app/globals.css", import.meta.url)), "utf8");
const LAYOUT = /\b(width|height|top|left|right|bottom|margin[\w-]*|padding[\w-]*|inset|font-size|line-height|display|position)\s*:/;
const keyframes = (css: string, name: string) => css.slice(css.indexOf(`@keyframes ${name}`), css.indexOf("}", css.indexOf("}", css.indexOf(`@keyframes ${name}`)) + 1) + 1);

describe("the wash moves no layout and rests still under reduced motion (D11)", () => {
  it("animates only a background (the wash) and a ring (a control's success) — no layout property", () => {
    for (const name of ["kz-arrive-flash", "kz-status-ring"]) {
      const frames = keyframes(MOTION, name);
      expect(frames, name).toContain(`@keyframes ${name}`);
      expect(frames, name).not.toMatch(LAYOUT);
    }
  });

  it("under reduced motion: no animation, and a static marker on the changed row that moves nothing", () => {
    const reduced = MOTION.slice(MOTION.lastIndexOf("@media (prefers-reduced-motion: reduce)", MOTION.indexOf("[data-kz-arrive], tr:has([data-kz-arrive]), li:has(> [data-kz-arrive]), .kz-grow svg { animation: none")));
    expect(reduced).toMatch(/\[data-kz-arrive\], tr:has\(\[data-kz-arrive\]\), li:has\(> \[data-kz-arrive\]\), \.kz-grow svg \{ animation: none !important; \}/);
    expect(MOTION).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\[data-kz-status\][^{]*\{ animation: none !important; \}/);
    const marker = GLOBALS.slice(GLOBALS.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(marker).toMatch(/\[data-kz-arrival="flash"\][^{]*\[data-kz-arrive\][^{]*\{[^}]*box-shadow: inset[^}]*var\(--kz-accent\)/);
    expect(marker.slice(0, marker.indexOf("}") + 1)).not.toMatch(LAYOUT);
  });
});

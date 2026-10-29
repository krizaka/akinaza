import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { FRAME_PAPERS, framePaperOf, PAPERS, TEMPLATES } from "@akinaza/core";
import { describe, expect, it } from "vitest";

/** Contrast of the ink on each paper of the shop frame, in both themes (akinaza#305). The tokens are the library's own, read as published. */
const css = readFileSync(createRequire(import.meta.url).resolve("@krizaka/tokens/tokens.css"), "utf8");
const block = (selector: string) => {
  const start = css.indexOf(`${selector} {`);
  return css.slice(start, css.indexOf("\n}", start));
};
const token = (theme: string, name: string) => {
  const m = new RegExp(`--kz-${name}:\\s*hsl\\(([\\d.]+) ([\\d.]+)%\\s+([\\d.]+)%\\)`).exec(theme);
  if (!m) throw new Error(`token ${name} is not a plain hsl() in the theme`);
  return [Number(m[1]), Number(m[2]) / 100, Number(m[3]) / 100] as const;
};
type Rgb = readonly [number, number, number];
const rgb = ([h, s, l]: readonly [number, number, number]): Rgb => {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min((n + h / 30) % 12 - 3, 9 - ((n + h / 30) % 12), 1));
  return [f(0), f(8), f(4)];
};
const mix = (a: Rgb, b: Rgb, weightOfA: number): Rgb => [0, 1, 2].map((i) => a[i]! * weightOfA + b[i]! * (1 - weightOfA)) as unknown as Rgb;
const lum = (c: Rgb) => {
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: Rgb, b: Rgb) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
};

const THEMES = { dark: block(":root, .theme-dark"), light: block("html.light") };

/** Each paper: its background and the inks the frame sets on it (the `blocks.css` rules). */
function paperOf(name: (typeof FRAME_PAPERS)[number], theme: string): { paper: Rgb; inks: Rgb[] } {
  const c = (n: string) => rgb(token(theme, n));
  if (name === "kraft") return { paper: c("paper-kraft"), inks: [c("paper-kraft-ink")] };
  const surface = c("surface-0");
  const paper = name === "washi" ? mix(surface, c("accent"), 0.94) : surface;
  return { paper, inks: [c("text-primary"), c("text-secondary")] };
}

describe("the papers of a shop page (akinaza#305)", () => {
  for (const [themeName, theme] of Object.entries(THEMES)) {
    for (const name of FRAME_PAPERS) {
      it(`${name} keeps its ink readable in the ${themeName} theme`, () => {
        const { paper, inks } = paperOf(name, theme);
        for (const ink of inks) expect(ratio(paper, ink)).toBeGreaterThanOrEqual(name === "kraft" ? 7 : 4.5);
      });
    }
  }
  it("turns every paper of a template into one of the four of the frame", () => {
    for (const p of PAPERS) expect(FRAME_PAPERS).toContain(framePaperOf(p));
    for (const t of TEMPLATES) expect(FRAME_PAPERS).toContain(framePaperOf(t.paper));
    expect(framePaperOf("ruled")).toBe("seyes");
    expect(framePaperOf("dot-grid")).toBe("washi");
  });
});

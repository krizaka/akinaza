#!/usr/bin/env node
// No empty map (akinaza#488): on the pages that draw a map, the live map's box must have a size and a canvas. The shop page's map once drew as an empty
// grey box (the map was `absolute inset-0` in a frame with no height of its own: 0 px); nothing in the crawl noticed, because a 0 px element overflows nothing.
//
//   node scripts/check-maps.mjs --base http://localhost:3000
import { chromium } from "playwright-core";

/** The shop pages with a map (the demo shop with zones), at the width where the live map shows at once (`sm` and up). */
export const MAP_PAGES = ["/fr/s/pattes-saint-henri", "/en/s/pattes-saint-henri"];
export const MIN_SIDE = 120;
export const SETTLE_MS = 4000;

/** What a map must be, from its measures (`{ width, height, canvasWidth, canvasHeight }`). Pure. */
export function mapProblems(where, m) {
  if (!m) return [`${where}: no map on the page`];
  const out = [];
  if (m.height < MIN_SIDE || m.width < MIN_SIDE) out.push(`${where}: the map box is ${Math.round(m.width)}x${Math.round(m.height)} px (empty)`);
  if (!m.canvasWidth || !m.canvasHeight) out.push(`${where}: the map has no canvas`);
  return out;
}

const measure = () => {
  const root = document.querySelector(".maplibregl-map");
  if (!root) return null;
  const box = root.getBoundingClientRect();
  const canvas = root.querySelector("canvas");
  const c = canvas?.getBoundingClientRect();
  return { width: box.width, height: box.height, canvasWidth: c?.width ?? 0, canvasHeight: c?.height ?? 0 };
};

export async function check({ base }) {
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const problems = [];
  try {
    for (const theme of ["dark", "light"]) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      await context.addInitScript((t) => localStorage.setItem("kz-theme", t), theme);
      const page = await context.newPage();
      for (const route of MAP_PAGES) {
        await page.goto(`${base}${route}`, { waitUntil: "load" });
        await page.waitForSelector(".maplibregl-map", { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(SETTLE_MS);
        problems.push(...mapProblems(`${route} (${theme})`, await page.evaluate(measure)));
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf("--base");
  const problems = await check({ base: i >= 0 ? process.argv[i + 1] : "http://localhost:3000" });
  if (problems.length) {
    console.error(`${problems.length} empty map(s):\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`maps drawn: ${MAP_PAGES.length} pages x 2 themes`);
}

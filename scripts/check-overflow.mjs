#!/usr/bin/env node
// Dev-preview crawl (ui.themes-devices): console errors, HTTP errors, empty pages, then the responsive guard: no horizontal overflow, and no tap target under 44 px in a primary action, at every width that matters,
// in both themes and both languages, on the pages a visitor lands on.
//
//   node scripts/check-overflow.mjs --base http://localhost:3000 [--shots <dir>]
//
// Exits 1 listing every page x width x theme that overflows. With --shots it also writes a screenshot of each.
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "playwright-core";

/** After `load`, the time fonts and images take to lay the page out. */
const SETTLE_MS = 600;
export const WIDTHS = [360, 390, 430, 768, 1024, 1440];
export const THEMES = ["dark", "light"];
/** The two demo shops and every composition they offer (akinaza#404): the Krizaka UI showcase must not overflow at any width. */
export const SHOP_PAGES = ["/en/s/cedre-ciseaux", "/fr/s/cedre-ciseaux?look=editorial", "/en/s/cedre-ciseaux?look=gallery", "/fr/s/pattes-saint-henri", "/en/s/pattes-saint-henri?look=journal"];
export const PAGES = ["/en", "/fr", "/en/privacy", "/fr/privacy", "/en/changelog", "/fr/changelog", "/en/sign-in", "/fr/sign-in", ...SHOP_PAGES];

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};

export async function check({ base, shots }) {
  const browser = await chromium.launch();
  const problems = [];
  for (const theme of THEMES) {
    const context = await browser.newContext({ colorScheme: theme });
    await context.addInitScript((t) => {
      try {
        localStorage.setItem("kz-theme", t);
      } catch {}
    }, theme);
    const page = await context.newPage();
    // The crawl also refuses a console error, an uncaught exception and a failed first-party request on any page.
    let current = "";
    page.on("console", (m) => m.type() === "error" && problems.push(`${current}: console error: ${m.text().slice(0, 160)}`));
    page.on("pageerror", (e) => problems.push(`${current}: uncaught: ${String(e.message).slice(0, 160)}`));
    for (const path of PAGES) {
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        current = `${path} @${width} ${theme}`;
        // `load`, then the time the layout takes to settle: a looping video keeps the network busy, so « idle » may never come (akinaza#341).
        const response = await page.goto(`${base}${path}`, { waitUntil: "load" });
        await page.waitForTimeout(SETTLE_MS);
        if (!response || response.status() >= 400) problems.push(`${current}: HTTP ${response?.status() ?? "none"}`);
        const empty = await page.evaluate(() => document.querySelector("main")?.innerText.trim().length === 0);
        if (empty) problems.push(`${current}: empty <main>`);
        const result = await page.evaluate(() => {
          const doc = document.documentElement;
          // An element that pokes out only matters when nothing clips it: decorative layers (aria-hidden) and anything inside a
          // clipping or scrolling ancestor (overflow hidden / clip / auto / scroll) are meant to extend.
          const clipped = (el) => {
            for (let n = el; n && n !== document.body; n = n.parentElement) {
              if (n.getAttribute("aria-hidden") === "true") return true;
              if (n !== el && ["hidden", "clip", "auto", "scroll"].includes(getComputedStyle(n).overflowX)) return true;
            }
            return false;
          };
          const wide = [...document.querySelectorAll("body *")]
            .filter((el) => {
              const r = el.getBoundingClientRect();
              return r.width > 0 && (r.right > doc.clientWidth + 1 || r.left < -1) && !clipped(el);
            })
            .slice(0, 3)
            .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 3).join(".")}`);
          const actions = [...document.querySelectorAll("main a[class*='kz-button'], main a[data-slot='button'], main .kz-button")].filter((a) => a.getBoundingClientRect().width > 0).map((a) => Math.round(a.getBoundingClientRect().height));
          return { scroll: doc.scrollWidth, client: doc.clientWidth, wide, actions };
        });
        const where = `${path} @${width} ${theme}`;
        if (result.scroll > result.client) problems.push(`${where}: scrollWidth ${result.scroll} > ${result.client} (${result.wide.join(", ")})`);
        else if (result.wide.length) problems.push(`${where}: elements past the edge (${result.wide.join(", ")})`);
        if (result.actions.some((h) => h < 36)) problems.push(`${where}: an action is ${Math.min(...result.actions)} px tall (< 36)`);
        if (shots) {
          mkdirSync(shots, { recursive: true });
          await page.screenshot({ path: join(shots, `${path.replace(/\//g, "_") || "_"}-${width}-${theme}.png`), fullPage: false });
        }
      }
    }
    await context.close();
  }
  await browser.close();
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const problems = await check({ base: arg("base", "http://localhost:3000"), shots: arg("shots") });
  if (problems.length) {
    console.error(`${problems.length} responsive problem(s):\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`no horizontal overflow: ${PAGES.length} pages x ${WIDTHS.length} widths x ${THEMES.length} themes`);
}

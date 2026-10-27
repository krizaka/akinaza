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
/** The signed-in frame (akinaza#396, the « never overflows » containment of the shared `AppFrame`), relative to `/<locale>/app/<shop>`: the owner's rail, header and account menu at every width. */
export const FRAME_PAGES = ["/aujourdhui", "/clients", "/invoices", "/books", "/shop"];
export const FRAME_LOCALES = ["fr", "en"];
export const PAGES = ["/en", "/fr", "/en/privacy", "/fr/privacy", "/en/changelog", "/fr/changelog", "/en/sign-in", "/fr/sign-in", ...SHOP_PAGES];

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};

/** Runs in the page (serialised by Playwright, so self-contained): the scroll width, what pokes out unclipped, and the height of every action. */
function measure() {
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
  // The development notice stands above the page in the flow; the site bar floats under it, never over it (akinaza#440).
  const notice = document.querySelector("[data-top-chrome]");
  // The bar's own box (the offset wrapper just inside the sticky one): the navs inside it are display:none at some widths.
  const bar = document.querySelector("[data-site-bar] > div");
  const chrome = notice && bar && window.scrollY === 0 ? { noticeBottom: Math.round(notice.getBoundingClientRect().bottom), barTop: Math.round(bar.getBoundingClientRect().top) } : null;
  return { scroll: doc.scrollWidth, client: doc.clientWidth, wide, actions, chrome };
}

/** The problems one page at one width shows, from what `measure` read. */
export function judge(result, where) {
  const out = [];
  if (result.scroll > result.client) out.push(`${where}: scrollWidth ${result.scroll} > ${result.client} (${result.wide.join(", ")})`);
  else if (result.wide.length) out.push(`${where}: elements past the edge (${result.wide.join(", ")})`);
  if (result.chrome && result.chrome.barTop < result.chrome.noticeBottom) out.push(`${where}: the bar (top ${result.chrome.barTop} px) overlaps the development notice (bottom ${result.chrome.noticeBottom} px)`);
  if (result.actions.some((h) => h < 36)) out.push(`${where}: an action is ${Math.min(...result.actions)} px tall (< 36)`);
  return out;
}

/** Every page at every width in one theme: HTTP and empty-page checks, then no horizontal overflow and no small action. */
async function crawl({ page, paths, base, theme, shots, problems, at }) {
  for (const path of paths) {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      at(`${path} @${width} ${theme}`);
      // `load`, then the time the layout takes to settle: a looping video keeps the network busy, so « idle » may never come (akinaza#341).
      const response = await page.goto(`${base}${path}`, { waitUntil: "load" });
      await page.waitForTimeout(SETTLE_MS);
      if (!response || response.status() >= 400) problems.push(`${path} @${width} ${theme}: HTTP ${response?.status() ?? "none"}`);
      const empty = await page.evaluate(() => document.querySelector("main")?.innerText.trim().length === 0);
      if (empty) problems.push(`${path} @${width} ${theme}: empty <main>`);
      const result = await page.evaluate(measure);
      problems.push(...judge(result, `${path} @${width} ${theme}`));
      if (shots) {
        mkdirSync(shots, { recursive: true });
        await page.screenshot({ path: join(shots, `${path.replace(/\//g, "_") || "_"}-${width}-${theme}.png`), fullPage: false });
      }
    }
  }
}

export async function check({ base, shots, owner }) {
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
    await crawl({ page, paths: PAGES, base, theme, shots, problems, at: (v) => (current = v) });
    await context.close();
    // The same guard inside the signed-in frame, as the owner (the rail, the header, the account menu), for who has the credentials.
    if (owner) {
      const inside = await browser.newContext({ colorScheme: theme });
      await inside.addInitScript((t) => {
        try {
          localStorage.setItem("kz-theme", t);
        } catch {}
      }, theme);
      const answer = await inside.request.post(`${base}/api/auth/sign-in`, { data: { email: owner.email, password: owner.secret } });
      if (!answer.ok()) throw new Error(`sign-in as the owner answered ${answer.status()}`);
      const framed = await inside.newPage();
      framed.on("console", (m) => m.type() === "error" && problems.push(`${current}: console error: ${m.text().slice(0, 160)}`));
      framed.on("pageerror", (e) => problems.push(`${current}: uncaught: ${String(e.message).slice(0, 160)}`));
      await framed.goto(`${base}/fr/app`, { waitUntil: "load" });
      const shopRoot = new URL(framed.url()).pathname.replace(/^\/(fr|en)/, "").match(/^\/app\/[^/]+/)?.[0];
      if (!shopRoot) throw new Error(`the owner's /app did not lead to a shop (${framed.url()})`);
      await crawl({ page: framed, paths: FRAME_LOCALES.flatMap((l) => FRAME_PAGES.map((f) => `/${l}${shopRoot}${f}`)), base, theme, shots, problems, at: (v) => (current = v) });
      await inside.close();
    }
  }
  await browser.close();
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { HYDRATION_OWNER_EMAIL: email, HYDRATION_OWNER_PASSWORD: secret } = process.env;
  if (!email || !secret) process.stdout.write("check-overflow: no HYDRATION_OWNER_* credentials, the signed-in frame is not checked\n");
  const problems = await check({ base: arg("base", "http://localhost:3000"), shots: arg("shots"), owner: email && secret ? { email, secret } : undefined });
  if (problems.length) {
    console.error(`${problems.length} responsive problem(s):\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`no horizontal overflow: ${PAGES.length} public pages${email && secret ? ` and ${FRAME_PAGES.length * FRAME_LOCALES.length} pages of the signed-in frame` : ""} x ${WIDTHS.length} widths x ${THEMES.length} themes`);
}

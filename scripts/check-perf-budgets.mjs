#!/usr/bin/env node
// Performance budgets of the public shop pages (ADR-004, akinaza#401). The seeded demo shops, on a throttled phone profile
// (390 x 844, 4x CPU slowdown, slow 4G), each page sampled RUNS times, the median judged:
//   - LCP <= 2.5 s and the LCP element is the hero;  - CLS 0;  - at most 5 phone screens (page height / viewport height);
//   - client JavaScript per route (the bytes the page loads) may only go down: perf-budgets.json is the ratchet.
//
//   node scripts/check-perf-budgets.mjs --base http://localhost:3000 [--runs 3] [--update] [--out perf-report.json]
//
// LCP, CLS and the screens are absolute targets, never loosened. A route with no entry in perf-budgets.json has no JS baseline yet: it is
// reported, and `--update` records it (it never raises an existing entry). `PERF_BLOCKING=0` reports the absolute budgets without failing
// (the job's mode while the variance of the runs is being read); the JS ratchet is deterministic and always fails.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const BUDGETS_FILE = fileURLToPath(new URL("../perf-budgets.json", import.meta.url));
export const LIMITS = { lcpMs: 2500, cls: 0, screens: 5 };
export const SHOP_ROUTES = ["/en/s/cedre-ciseaux", "/fr/s/cedre-ciseaux", "/en/s/pattes-saint-henri", "/fr/s/pattes-saint-henri"];
export const VIEWPORT = { width: 390, height: 844 };
const HERO = '[class*="hero"], [data-section="hero"], [data-hero], main > :first-child';

export const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
export const spread = (xs) => (xs.length ? Math.max(...xs) - Math.min(...xs) : 0);

/** Phone screens a page takes: its height at 390 px over the viewport's height. */
export const screensOf = (pageHeight, viewportHeight = VIEWPORT.height) => Math.round((pageHeight / viewportHeight) * 100) / 100;

/** The medians of the samples of one route. */
export function summarise(samples) {
  return {
    lcpMs: Math.round(median(samples.map((s) => s.lcpMs))),
    cls: Math.round(median(samples.map((s) => s.cls)) * 1000) / 1000,
    screens: median(samples.map((s) => s.screens)),
    heroLcp: samples.every((s) => s.heroLcp),
    jsBytes: Math.round(median(samples.map((s) => s.jsBytes))),
    lcpSpreadMs: Math.round(spread(samples.map((s) => s.lcpMs))),
    clsSpread: Math.round(spread(samples.map((s) => s.cls)) * 1000) / 1000,
  };
}

/** The JS ratchet: a route may not load more bytes than recorded. No entry: no baseline yet (not a failure). */
export function ratchet(recorded, measured) {
  const increased = [];
  const decreased = [];
  const added = [];
  for (const [route, bytes] of Object.entries(measured)) {
    if (!(route in recorded)) added.push(route);
    else if (bytes > recorded[route]) increased.push({ route, from: recorded[route], to: bytes });
    else if (bytes < recorded[route]) decreased.push(route);
  }
  return { ok: increased.length === 0, increased, decreased, added };
}

/** The absolute budgets of one route (a summary from `summarise`), as a list of problems. */
export function judge(route, s, limits = LIMITS) {
  const out = [];
  if (s.lcpMs > limits.lcpMs) out.push(`${route}: LCP ${s.lcpMs} ms > ${limits.lcpMs} ms`);
  if (!s.heroLcp) out.push(`${route}: the LCP element is not the hero`);
  if (s.cls > limits.cls) out.push(`${route}: CLS ${s.cls} > ${limits.cls}`);
  if (s.screens > limits.screens) out.push(`${route}: ${s.screens} phone screens > ${limits.screens}`);
  return out;
}

/** The new ratchet entries: existing ones only go down, new routes are recorded at what was measured. */
export function lowered(recorded, measured) {
  const next = { ...recorded };
  for (const [route, bytes] of Object.entries(measured)) next[route] = route in next ? Math.min(next[route], bytes) : bytes;
  return next;
}

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};

/** In the page, before any script: collects the LCP (and whether its element is in the hero) and the layout shifts without recent input. */
function observe(heroSelector) {
  window.__perf = { lcp: 0, hero: false, cls: 0 };
  new PerformanceObserver((list) => {
    const e = list.getEntries().at(-1);
    window.__perf.lcp = e.startTime;
    window.__perf.hero = !!(e.element && e.element.closest(heroSelector));
  }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) if (!e.hadRecentInput) window.__perf.cls += e.value;
  }).observe({ type: "layout-shift", buffered: true });
}

async function sample(browser, url) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await context.addInitScript(observe, HERO);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  // Slow 4G, as Lighthouse's mobile profile: 150 ms RTT, 1.6 Mbit/s down, 750 kbit/s up.
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  let jsBytes = 0;
  const pending = [];
  page.on("response", (r) => {
    if (r.request().resourceType() === "script") pending.push(r.body().then((b) => (jsBytes += b.length)).catch(() => {}));
  });
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await Promise.all(pending);
  const perf = await page.evaluate(() => window.__perf);
  await context.close();
  return { lcpMs: perf.lcp, cls: perf.cls, screens: screensOf(height), heroLcp: perf.hero, jsBytes };
}

async function main() {
  const base = arg("base", "http://localhost:3000");
  const runs = Number(arg("runs", "3"));
  const out = arg("out", "perf-report.json");
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch();
  const report = {};
  for (const route of SHOP_ROUTES) {
    const samples = [];
    for (let i = 0; i < runs; i += 1) samples.push(await sample(browser, base + route));
    report[route] = { ...summarise(samples), samples };
    const s = report[route];
    console.log(`${route}: LCP ${s.lcpMs} ms (spread ${s.lcpSpreadMs}), hero ${s.heroLcp}, CLS ${s.cls} (spread ${s.clsSpread}), ${s.screens} screens, JS ${s.jsBytes} B`);
  }
  await browser.close();
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);

  const recorded = JSON.parse(readFileSync(BUDGETS_FILE, "utf8")).jsBytes ?? {};
  const measured = Object.fromEntries(Object.entries(report).map(([r, s]) => [r, s.jsBytes]));
  const js = ratchet(recorded, measured);
  if (js.added.length) console.log(`No JS baseline yet: ${js.added.join(", ")} (run with --update to record)`);
  if (process.argv.includes("--update")) writeFileSync(BUDGETS_FILE, `${JSON.stringify({ jsBytes: lowered(recorded, measured) }, null, 2)}\n`);

  const problems = Object.entries(report).flatMap(([route, s]) => judge(route, s));
  const jsProblems = js.increased.map((i) => `${i.route}: client JS ${i.to} B > ${i.from} B recorded`);
  for (const p of [...problems, ...jsProblems]) console.error(`FAIL ${p}`);
  const blocking = process.env.PERF_BLOCKING !== "0";
  if (jsProblems.length || (blocking && problems.length)) process.exit(1);
  if (problems.length) console.log("Absolute budgets missed, reported without failing (PERF_BLOCKING=0).");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();

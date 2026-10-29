#!/usr/bin/env node
// The home's hero take and its three screen stills, on today's product (akinaza#554): Éric (the Krizaka studio's owner, a persona, never the
// administrator) on a phone, with the notebook storefront on. One continuous take: the public page of his studio → Today → an invoice →
// « Your books ». Captured with the Chrome DevTools screencast (every frame the compositor paints, with its timestamp) and encoded at a
// constant 30 fps. It writes, per language, `hero-<l>.{mp4,webm}`, its poster `phone-hero-<l>.jpg` and the stills `phone-{book,invoice,books}-<l>.jpg`
// (780 × 1688), the names `lib/tour.ts` and krizaka.com's story read once they are uploaded hashed (krizaka-com `cdn-assets upload`).
//
//   E2E_BASE=http://localhost:3217 E2E_LOCALE=fr E2E_OUT=<dir> E2E_ERIC_EMAIL=… E2E_ERIC_PASSWORD=… [E2E_SLUG=krizaka-demo] node scripts/record-hero.mjs
//
// The database is a seeded, throw-away one (`seed-krizaka.mjs`, `apply-shop-template.mjs krizaka-demo consulting-histoire`, the
// `features.cahierStorefront` flag for Éric): dev.akinaza.com redirects its pages to www by design. Needs Chromium for playwright-core and ffmpeg.
// The password stays in the environment and is never printed. Nothing is sent: Éric only reads.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { ffmpeg, glide, listenScreencast, spanOf, writeConcatList } from "./lib/take.mjs";

export const PHONE = { width: 390, height: 844 };
export const SCALE = 2;

/** The files of a language's capture, by the names the CDN folder `tour/` keeps (a hash is added on upload). */
export const filesOf = (locale) => ({
  mp4: `hero-${locale}.mp4`,
  webm: `hero-${locale}.webm`,
  poster: `phone-hero-${locale}.jpg`,
  stills: { book: `phone-book-${locale}.jpg`, invoice: `phone-invoice-${locale}.jpg`, books: `phone-books-${locale}.jpg` },
});

/** The words a scene waits for before it is shot (the page is in this language, or the capture is not of today's text). */
export const WORDS = {
  fr: { choose: "Choisissez, puis réservez", today: "Que faire maintenant", invoice: "Facture", books: "Vos livres" },
  en: { choose: "Choose, then book", today: "What to do now", invoice: "Invoice", books: "Your books" },
};

async function main() {
  const require = createRequire(import.meta.url);
  const { chromium } = require("playwright-core");
  const BASE = (process.env.E2E_BASE ?? "http://localhost:3217").replace(/\/$/, "");
  const LOCALE = process.env.E2E_LOCALE === "en" ? "en" : "fr";
  const OUT = path.resolve(process.env.E2E_OUT ?? "record-out");
  const SLUG = process.env.E2E_SLUG ?? "krizaka-demo";
  const need = (name) => {
    if (!process.env[name]) throw new Error(`${name} is required`);
    return process.env[name];
  };
  const eric = { email: need("E2E_ERIC_EMAIL"), password: need("E2E_ERIC_PASSWORD") };
  const w = WORDS[LOCALE];
  const files = filesOf(LOCALE);
  const FRAMES = path.join(OUT, `frames-${LOCALE}`);
  rmSync(FRAMES, { recursive: true, force: true });
  mkdirSync(FRAMES, { recursive: true });

  const beats = [];
  const frames = [];
  const calls = [];
  const log = (ok, what) => process.stdout.write(`${ok ? "ok  " : "FAIL"} ${what}\n`);
  const now = () => spanOf(frames);
  const mark = (name) => beats.push({ name, at: Number(now().toFixed(3)) });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: PHONE, deviceScaleFactor: SCALE, locale: LOCALE === "fr" ? "fr-CA" : "en-CA", timezoneId: "America/Toronto", isMobile: true, hasTouch: true, colorScheme: "dark" });
  await context.addInitScript(() => {
    try {
      localStorage.setItem("kz-theme", "dark");
    } catch {
      /* none */
    }
    // The development server's own indicator is not the product.
    const style = document.createElement("style");
    style.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.append(style));
  });
  const page = await context.newPage();
  page.on("response", (res) => {
    const url = new URL(res.url());
    if (url.pathname.startsWith("/api/")) calls.push({ method: res.request().method(), path: url.pathname, status: res.status() });
  });
  page.on("pageerror", (e) => log(false, `no page error (${e.message.slice(0, 120)})`));
  const cdp = await listenScreencast(context, page, frames);
  const settle = async (text) => {
    await page.waitForLoadState("networkidle");
    await page.getByText(text).first().waitFor({ timeout: 60_000 });
    await page.waitForTimeout(900);
  };
  const still = async (name) => {
    await page.screenshot({ path: path.join(OUT, name), type: "jpeg", quality: 90 });
    log(true, `still ${name}`);
  };

  try {
    // 0 — the studio's public page, notebook storefront: the stills are shot before the take (no screencast running).
    await page.goto(`${BASE}/${LOCALE}/s/${SLUG}`, { waitUntil: "networkidle" });
    await settle(w.choose);
    await page.getByText(w.choose).first().scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -90));
    await page.waitForTimeout(700);
    await still(files.stills.book);
    await page.evaluate(() => window.scrollTo(0, 0));

    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 88, maxWidth: PHONE.width * SCALE, maxHeight: PHONE.height * SCALE, everyNthFrame: 1 });
    await page.waitForTimeout(1100);
    mark("storefront");
    await glide(page, 560, 1900);
    await page.waitForTimeout(800);
    await glide(page, 640, 1900);
    await page.waitForTimeout(700);
    await glide(page, -1200, 1500);

    // 1 — Éric signs in: Today, what to do now.
    const res = await context.request.post(`${BASE}/api/auth/sign-in`, { data: { email: eric.email, password: eric.password } });
    calls.push({ method: "POST", path: "/api/auth/sign-in", status: res.status() });
    if (!res.ok()) throw new Error(`sign-in refused (${res.status()})`);
    await page.goto(`${BASE}/${LOCALE}/app`, { waitUntil: "networkidle" });
    await settle(w.today);
    const shopId = page.url().match(/\/app\/([0-9a-f-]{36})\//)?.[1];
    if (!shopId) throw new Error(`Éric did not land on his shop: ${page.url()}`);
    mark("today");
    await page.waitForTimeout(1100);
    await glide(page, 520, 1700);
    await page.waitForTimeout(1300);
    await glide(page, 520, 1700);
    await page.waitForTimeout(1100);

    // 2 — an invoice: the list, then one.
    await page.goto(`${BASE}/${LOCALE}/app/${shopId}/invoices`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1300);
    mark("invoices");
    const href = await page.evaluate(() => [...document.querySelectorAll("a[href*='/invoices/']")].map((a) => a.getAttribute("href")).find((h) => h && !h.includes("/new")));
    if (!href) throw new Error("no invoice to open");
    await glide(page, 360, 1300);
    await page.waitForTimeout(700);
    await page.goto(`${BASE}${href}`, { waitUntil: "networkidle" });
    await settle(w.invoice);
    mark("invoice");
    await page.waitForTimeout(1100);
    await still(files.stills.invoice);
    await glide(page, 560, 1800);
    await page.waitForTimeout(1300);

    // 3 — « Your books »: the quarter's GST and QST, prepared and never filed.
    await page.goto(`${BASE}/${LOCALE}/app/${shopId}/books`, { waitUntil: "networkidle" });
    await settle(w.books);
    mark("books");
    await page.waitForTimeout(1200);
    await still(files.stills.books);
    await glide(page, 520, 1700);
    await page.waitForTimeout(1300);
    await glide(page, 520, 1700);
    await page.waitForTimeout(1500);
    mark("end");
  } finally {
    await cdp.send("Page.stopScreencast").catch(() => {});
    await browser.close();
  }

  // Encode: each frame is held until the next one (the screencast only sends what changed), then a constant 30 fps.
  const duration = spanOf(frames);
  const list = writeConcatList(frames, FRAMES);
  const ff = ffmpeg;
  const input = ["-f", "concat", "-safe", "0", "-i", list, "-vf", "fps=30,scale=540:-2:flags=lanczos", "-an"];
  ff([...input, "-c:v", "libx264", "-crf", "24", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", path.join(OUT, files.mp4)]);
  ff([...input, "-c:v", "libvpx-vp9", "-crf", "36", "-b:v", "0", "-row-mt", "1", path.join(OUT, files.webm)]);
  // The poster is the take's first second at the stills' size (780 × 1688): the page's LCP.
  ff(["-i", path.join(FRAMES, "00010.jpg"), "-vf", "scale=780:1688:flags=lanczos", "-q:v", "3", path.join(OUT, files.poster)]);
  rmSync(FRAMES, { recursive: true, force: true });

  const gaps = frames.slice(1).map((f, i) => f.t - frames[i].t);
  const moving = gaps.filter((g) => g < 0.1);
  const activeFps = moving.length / moving.reduce((s, g) => s + g, 0);
  writeFileSync(path.join(OUT, `journey-${LOCALE}.json`), `${JSON.stringify({ base: BASE, locale: LOCALE, persona: "eric", durationSeconds: Number(duration.toFixed(2)), activeCaptureFps: Number(activeFps.toFixed(1)), beats, calls }, null, 2)}\n`);
  log(activeFps >= 25, `capture rate while moving: ${activeFps.toFixed(1)} fps (${frames.length} frames over ${duration.toFixed(1)} s)`);
  log(calls.every((c) => c.status < 500), "no API call answered with a server error");
  process.stdout.write(`take: ${path.join(OUT, files.mp4)}\nbeats: ${beats.map((b) => `${b.name}@${b.at}`).join(" ")}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`record-hero: ${error.message}`);
    process.exit(1);
  });
}

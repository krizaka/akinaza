#!/usr/bin/env node
// One continuous phone take of Akinaza's journey on a running deployment, as the fictional Saint-Henri persona, captured
// with the Chrome DevTools screencast (every frame the compositor paints, with its timestamp) and encoded at a constant
// 30 fps: the storefront → a service and a slot → booking confirmed → the walker's day with check-in/out → the report →
// what the client receives → « Vos livres » (GST/QST of the quarter). It writes the full take, one clip per beat (cut
// from the same take, for the StepShowcase), a poster per beat and journey.json (the API calls with their request ids,
// the beats' times and the capture's real frame rate).
//
//   E2E_BASE=https://dev.akinaza.com E2E_LOCALE=fr E2E_OUT=<dir> \
//   E2E_CLIENT_EMAIL=… E2E_CLIENT_PASSWORD=… E2E_CLIENT_DOG=Rex E2E_WALKER_EMAIL=… E2E_WALKER_PASSWORD=… \
//     node scripts/record-journey.mjs
//
// Needs Chromium for playwright-core and ffmpeg. Passwords stay in the environment and are never printed. It adds one
// booking, one check-in/out and one sent report on the persona's data: demo database only.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { ffmpeg, glide, listenScreencast, spanOf, writeConcatList } from "./lib/take.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const BASE = (process.env.E2E_BASE ?? "http://localhost:3210").replace(/\/$/, "");
const LOCALE = process.env.E2E_LOCALE === "en" ? "en" : "fr";
const OUT = path.resolve(process.env.E2E_OUT ?? "record-out");
const SLUG = process.env.E2E_SLUG ?? "pattes-saint-henri";
const need = (name) => {
  if (!process.env[name]) throw new Error(`${name} is required`);
  return process.env[name];
};
const client = { email: need("E2E_CLIENT_EMAIL"), password: need("E2E_CLIENT_PASSWORD"), dog: need("E2E_CLIENT_DOG") };
const walker = { email: need("E2E_WALKER_EMAIL"), password: need("E2E_WALKER_PASSWORD") };

const W = {
  fr: { book: "Réserver", confirm: "Réserver cette promenade", done: "Réservé!", checkIn: "Commencer la promenade", checkOut: "Terminer la promenade", note: "Note pour le propriétaire", save: "Enregistrer le rapport", saved: "Rapport enregistré.", next: "Jour suivant", afterSend: /Envoyé à|Enregistré et en attente/, reportTitle: (d) => `Rapport pour ${d}`, send: /^Envoyer à/ },
  en: { book: "Book", confirm: "Book this walk", done: "Booked!", checkIn: "Start the walk", checkOut: "End the walk", note: "Note for the owner", save: "Save the report", saved: "Report saved.", next: "Next day", afterSend: /Sent to|Saved and waiting/, reportTitle: (d) => `Report for ${d}`, send: /^Send to/ },
}[LOCALE];

const PHONE = { width: 390, height: 844 };
const SCALE = 2;
const FRAMES = path.join(OUT, `frames-${LOCALE}`);
rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });

const calls = [];
const beats = [];
const frames = [];
const log = (ok, what) => process.stdout.write(`${ok ? "ok  " : "FAIL"} ${what}\n`);
const now = () => spanOf(frames);
const mark = (name) => beats.push({ name, at: Number(now().toFixed(3)) });
const hold = (page, ms) => page.waitForTimeout(ms);

async function signInAs(context, who) {
  await context.clearCookies();
  const res = await context.request.post(`${BASE}/api/auth/sign-in`, { data: { email: who.email, password: who.password } });
  calls.push({ method: "POST", path: "/api/auth/sign-in", status: res.status(), requestId: res.headers()["x-request-id"] ?? null });
  if (!res.ok()) throw new Error(`sign-in refused (${res.status()})`);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: PHONE, deviceScaleFactor: SCALE, locale: LOCALE === "fr" ? "fr-CA" : "en-CA", timezoneId: "America/Toronto", isMobile: true, hasTouch: true, colorScheme: "dark" });
await context.addInitScript(() => {
  try {
    localStorage.setItem("kz-theme", "dark");
  } catch {}
});
const page = await context.newPage();
page.on("response", (res) => {
  const url = new URL(res.url());
  if (url.pathname.startsWith("/api/")) calls.push({ method: res.request().method(), path: url.pathname, status: res.status(), requestId: res.headers()["x-request-id"] ?? null });
});
page.on("pageerror", (e) => log(false, `no page error (${e.message.slice(0, 120)})`));

const cdp = await listenScreencast(context, page, frames);

try {
  await page.goto(`${BASE}/${LOCALE}/s/${SLUG}`, { waitUntil: "networkidle" });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 88, maxWidth: PHONE.width * SCALE, maxHeight: PHONE.height * SCALE, everyNthFrame: 1 });
  await hold(page, 900);
  mark("storefront");

  // 1 — the storefront, then a service and a slot, then the booking.
  await glide(page, 520, 1800);
  await hold(page, 700);
  await glide(page, 620, 1800);
  await hold(page, 600);
  await glide(page, -1140, 1500);
  await signInAs(context, client); // the client is signed in: « Book » leads straight to the booking page
  await page.getByRole("link", { name: W.book, exact: true }).locator("visible=true").first().click();
  await page.locator("main select").first().waitFor();
  mark("book");
  await hold(page, 700);
  await page.locator("main select").first().selectOption({ index: 2 }); // the group walk
  await hold(page, 600);
  await page.locator("main select").nth(1).selectOption({ index: 0 });
  await hold(page, 500);
  await page.getByRole("checkbox").first().check();
  await hold(page, 500);
  // The persona's reset leaves every client an open 14:00 walk: the booking of the take is the 15:00 one.
  const slots = page.getByRole("radio").filter({ hasText: /^15 h 00|^0?3:00 p/ });
  await slots.first().waitFor();
  // A day nobody used yet (earlier takes consume the early days): E2E_DAY_FROM_END = 1 is the last offered day.
  const slot = slots.nth((await slots.count()) - Number(process.env.E2E_DAY_FROM_END ?? 1));
  await slot.scrollIntoViewIfNeeded();
  await hold(page, 600);
  await slot.click();
  await hold(page, 900);
  await page.getByRole("button", { name: W.confirm }).scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: W.confirm }).click();
  await page.getByText(W.done).waitFor();
  log(true, `booked a group walk for ${client.dog}`);
  await hold(page, 1700);
  mark("booked");

  // 2 — the walker's day: check-in, check-out, the report with a photo, sent.
  await signInAs(context, walker);
  await page.goto(`${BASE}/${LOCALE}/app`, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: W.next }).first().waitFor();
  mark("day");
  await hold(page, 900);
  // The booked walk is the 15:00 one (the persona's reset leaves each client an open 14:00 walk): step forward to its day.
  const mine = () => page.locator("[aria-labelledby^=visit-]").filter({ hasText: client.dog }).filter({ hasText: /15 h 00\s*[–-]\s*16 h 00|3:00.{0,8}4:00/ }).filter({ has: page.getByRole("button", { name: W.checkIn }) });
  for (let i = 0; i < 16 && (await mine().count()) === 0; i++) {
    const day = new Date(Date.now() + i * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
    await page.goto(`${BASE}/${LOCALE}/app?day=${day}`, { waitUntil: "networkidle" });
  }
  const cardId = await mine().first().getAttribute("aria-labelledby");
  const card = page.locator(`[aria-labelledby="${cardId}"]`); // stable once the walk has started
  await card.scrollIntoViewIfNeeded();
  await hold(page, 1100);
  await card.getByRole("button", { name: W.checkIn }).click();
  await card.getByRole("button", { name: W.checkOut }).waitFor();
  log(true, "checked in");
  await hold(page, 1300);
  await card.getByRole("button", { name: W.checkOut }).click();
  const box = card.getByRole("form", { name: W.reportTitle(client.dog) });
  await box.waitFor();
  mark("report");
  const photo = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 960;
    const g = canvas.getContext("2d");
    const sky = g.createLinearGradient(0, 0, 0, 960);
    sky.addColorStop(0, "#9ad0ff");
    sky.addColorStop(1, "#d9f0c8");
    g.fillStyle = sky;
    g.fillRect(0, 0, 1280, 960);
    g.fillStyle = "#4f9d4a";
    g.fillRect(0, 700, 1280, 260);
    g.font = "360px serif";
    g.fillText("🐕", 300, 700);
    g.font = "bold 44px sans-serif";
    g.fillStyle = "#0c3b1f";
    g.fillText("Illustration — Akinaza demo", 330, 860);
    return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
  });
  const photoPath = path.join(OUT, "walk.jpg");
  writeFileSync(photoPath, Buffer.from(photo, "base64"));
  await box.getByLabel(W.note).pressSequentially(LOCALE === "fr" ? `${client.dog} a bien marché, 52 min autour du canal Lachine, pipi ✓` : `${client.dog} walked well, 52 min along the Lachine canal, pee ✓`, { delay: 28 });
  await hold(page, 500);
  await box.locator("input[type=file]").setInputFiles(photoPath);
  await hold(page, 900);
  await box.getByRole("button", { name: W.save }).click();
  await box.getByText(W.saved).waitFor();
  log(true, "the report is saved with its photo");
  await hold(page, 800);
  const send = box.getByRole("button", { name: W.send });
  await send.scrollIntoViewIfNeeded();
  await hold(page, 500);
  await send.click();
  await box.getByText(W.afterSend).waitFor();
  log(true, "the report was sent");
  await hold(page, 1500);
  mark("sent");

  // 3 — the client reads it.
  await signInAs(context, client);
  await page.goto(`${BASE}/${LOCALE}/app`, { waitUntil: "networkidle" });
  const image = page.locator("img[src*='/api/me/reports/']").first();
  await image.waitFor();
  await image.scrollIntoViewIfNeeded();
  const loaded = await page.waitForFunction((el) => el.complete && el.naturalWidth > 0, await image.elementHandle(), { timeout: 10_000 }).then(() => true, () => false);
  log(loaded, "the photo of the report loads in her space");
  mark("client");
  await hold(page, 2200);

  // 4 — « Vos livres »: the quarter's GST and QST, prepared and never filed.
  await signInAs(context, walker);
  await page.goto(`${BASE}/${LOCALE}/app/books`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /^(Vos livres|Your books)$/ }).waitFor();
  mark("books");
  await hold(page, 1400);
  await glide(page, 520, 1700);
  await hold(page, 500);
  const sources = page.locator("summary").first();
  if (await sources.count()) {
    await sources.scrollIntoViewIfNeeded();
    await sources.click();
  }
  await hold(page, 1800);
  await glide(page, 420, 1400);
  await hold(page, 1600);
  mark("end");
} finally {
  await cdp.send("Page.stopScreencast").catch(() => {});
  await browser.close();
}

// Encode: each frame is held until the next one (the screencast only sends what changed), then a constant 30 fps.
const duration = spanOf(frames);
const list = writeConcatList(frames, FRAMES);
const full = path.join(OUT, `take-${LOCALE}.mp4`);
ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-vf", "fps=30,scale=780:-2:flags=lanczos", "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", full]);

// The real capture rate: frames the compositor painted per second while the page was moving (gaps under 100 ms).
const gaps = frames.slice(1).map((f, i) => f.t - frames[i].t);
const moving = gaps.filter((g) => g < 0.1);
const activeFps = moving.length / moving.reduce((s, g) => s + g, 0);
const meta = { base: BASE, locale: LOCALE, viewport: PHONE, scale: SCALE, durationSeconds: Number(duration.toFixed(2)), frames: frames.length, activeCaptureFps: Number(activeFps.toFixed(1)), outputFps: 30, beats, calls };
writeFileSync(path.join(OUT, `journey-${LOCALE}.json`), JSON.stringify(meta, null, 2));
log(activeFps >= 25, `capture rate while moving: ${activeFps.toFixed(1)} fps (${frames.length} frames over ${duration.toFixed(1)} s)`);
log(calls.every((c) => c.status < 500), "no API call answered with a server error");
process.stdout.write(`take: ${full}\nbeats: ${beats.map((b) => `${b.name}@${b.at}`).join(" ")}\n`);

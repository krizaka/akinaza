#!/usr/bin/env node
// End-to-end journey of the dog walker (Akinaza#52) on a running deployment, in a real browser, as the fictional Saint-Henri
// persona: a client signs in on her phone, adds a second dog and books a group walk; the walker opens her day, starts the
// walk, ends it, writes the report with a photo and sends it; the client reads the report. Every API call is recorded with
// its request id (journey.json) — the proof that the video is a real run. Optionally records each part as a video.
//
//   E2E_BASE=https://dev.akinaza.com \
//   E2E_CLIENT_EMAIL=… E2E_CLIENT_PASSWORD=… E2E_WALKER_EMAIL=… E2E_WALKER_PASSWORD=… \
//   E2E_OUT=<dir> [E2E_VIDEO=1] [E2E_LOCALE=fr] pnpm run e2e:walker
//
// It needs a Chromium for playwright-core (PLAYWRIGHT_BROWSERS_PATH or the default cache). Nothing but the checks is printed;
// passwords stay in the environment. It adds one dog and one booking on the client's file: run it on a throw-away or demo
// database, never on someone's real data.
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const BASE = (process.env.E2E_BASE ?? "http://localhost:3210").replace(/\/$/, "");
const LOCALE = process.env.E2E_LOCALE === "en" ? "en" : "fr";
const OUT = process.env.E2E_OUT ?? "e2e-walker-out";
const VIDEO = process.env.E2E_VIDEO === "1";
const SLUG = process.env.E2E_SLUG ?? "pattes-saint-henri";
const need = (name) => {
  if (!process.env[name]) throw new Error(`${name} is required`);
  return process.env[name];
};
const client = { email: need("E2E_CLIENT_EMAIL"), password: need("E2E_CLIENT_PASSWORD") };
const walker = { email: need("E2E_WALKER_EMAIL"), password: need("E2E_WALKER_PASSWORD") };
mkdirSync(OUT, { recursive: true });

// The words of the interface, in the language of the run (the same strings as messages/<locale>.json).
const W = {
  fr: {
    book: "Réserver une promenade",
    email: "Courriel",
    password: "Mot de passe",
    signIn: "Se connecter",
    addAnother: "Ajouter un autre chien",
    dogName: "Nom",
    breed: "Race",
    size: "Taille",
    temperament: "Tempérament",
    addDog: "Ajouter le chien",
    service: "Service",
    zone: "Zone",
    confirm: "Réserver cette promenade",
    done: "Réservé!",
    checkIn: "Commencer la promenade",
    checkOut: "Terminer la promenade",
    note: "Note pour le propriétaire",
    save: "Enregistrer le rapport",
    saved: "Rapport enregistré.",
    next: "Jour suivant",
    afterSend: /Envoyé à Sofia|Enregistré et en attente/,
    reportTitle: (dog) => `Rapport pour ${dog}`,
    send: (owner) => `Envoyer à ${owner}`,
    captions: {
      page: "Une page boutique publique : services, prix, zones, disponibilités",
      signIn: "Sofia se connecte pour réserver",
      dog: "Elle ajoute un deuxième chien : Miso",
      pick: "Elle choisit la promenade en groupe, Saint-Henri, ses deux chiens",
      booked: "Réservé : ses chiens se joignent à la promenade en groupe",
      walker: "Léa ouvre sa journée sur son téléphone",
      start: "Départ de la promenade : un toucher",
      end: "Fin de la promenade",
      report: "Une note et une photo pour chaque chien",
      sent: "Le rapport part vers la propriétaire",
      client: "Sofia retrouve le rapport dans son espace",
    },
  },
  en: {
    book: "Book a walk",
    email: "E-mail",
    password: "Password",
    signIn: "Sign in",
    addAnother: "Add another dog",
    dogName: "Name",
    breed: "Breed",
    size: "Size",
    temperament: "Temperament",
    addDog: "Add the dog",
    service: "Service",
    zone: "Zone",
    confirm: "Book this walk",
    done: "Booked!",
    checkIn: "Start the walk",
    checkOut: "End the walk",
    note: "Note for the owner",
    save: "Save the report",
    saved: "Report saved.",
    next: "Next day",
    afterSend: /Sent to Sofia|Saved and waiting/,
    reportTitle: (dog) => `Report for ${dog}`,
    send: (owner) => `Send to ${owner}`,
    captions: {
      page: "A public shop page: services, prices, zones, availability",
      signIn: "Sofia signs in to book",
      dog: "She adds a second dog: Miso",
      pick: "She picks the group walk, Saint-Henri, both dogs",
      booked: "Booked: her dogs join the group walk",
      walker: "Léa opens her day on her phone",
      start: "Walk starts: one tap",
      end: "Walk ends",
      report: "A note and a photo for each dog",
      sent: "The report goes to the owner",
      client: "Sofia finds the report in her space",
    },
  },
}[LOCALE];

let failed = 0;
const check = (ok, what) => {
  process.stdout.write(`${ok ? "ok  " : "FAIL"} ${what}\n`);
  if (!ok) failed += 1;
};
const calls = [];
const PHONE = { width: 430, height: 932 };

async function caption(page, text) {
  await page.evaluate((t) => {
    let el = document.getElementById("e2e-caption");
    if (!el) {
      el = document.createElement("div");
      el.id = "e2e-caption";
      el.setAttribute("aria-hidden", "true");
      el.style.cssText = "position:fixed;left:10px;right:10px;bottom:10px;z-index:2147483647;padding:10px 14px;border-radius:12px;background:rgba(9,9,11,.92);color:#fff;font:600 15px/1.3 system-ui,sans-serif;text-align:center;pointer-events:none";
      document.body.appendChild(el);
      // Room under the caption: nothing the viewer needs to see hides behind it.
      document.documentElement.style.scrollPaddingBottom = "110px";
      document.body.style.paddingBottom = "110px";
    }
    el.textContent = t;
  }, text);
}
const beat = (page, ms = 900) => page.waitForTimeout(ms);

async function open(browser, name) {
  const context = await browser.newContext({
    viewport: PHONE,
    deviceScaleFactor: 2,
    locale: LOCALE === "fr" ? "fr-CA" : "en-CA",
    timezoneId: "America/Toronto",
    isMobile: true,
    hasTouch: true,
    ...(VIDEO ? { recordVideo: { dir: path.join(OUT, "video", name), size: { width: PHONE.width * 2, height: PHONE.height * 2 } } } : {}),
  });
  const page = await context.newPage();
  page.on("response", (res) => {
    const url = new URL(res.url());
    if (url.pathname.startsWith("/api/")) calls.push({ part: name, method: res.request().method(), path: url.pathname, status: res.status(), requestId: res.headers()["x-request-id"] ?? null });
  });
  page.on("pageerror", (e) => check(false, `no page error (${e.message.slice(0, 120)})`));
  return { context, page };
}

async function signIn(page, who) {
  await page.getByLabel(W.email).fill(who.email);
  await page.getByLabel(W.password).fill(who.password);
  await page.getByRole("button", { name: W.signIn }).click();
}

async function close(part) {
  const video = part.page.video();
  await part.context.close();
  return video ? await video.path() : null;
}

const browser = await chromium.launch();
try {
  // 1 — the client: the public page, sign-in, a second dog, a group walk.
  const c = await open(browser, "1-client");
  await c.page.goto(`${BASE}/${LOCALE}/s/${SLUG}`);
  await c.page.getByRole("heading", { level: 1 }).waitFor();
  await caption(c.page, W.captions.page);
  check((await c.page.getByText(/Saint-Henri/).count()) > 0, "the public shop page names its zones");
  await beat(c.page, 1800);
  await c.page.screenshot({ path: path.join(OUT, "01-shop-page.png") });
  await c.page.getByRole("link", { name: W.book }).first().click();
  await c.page.getByLabel(W.email).waitFor();
  await caption(c.page, W.captions.signIn);
  await signIn(c.page, client);
  await c.page.getByRole("button", { name: W.addAnother }).waitFor();
  check(c.page.url().includes(`/s/${SLUG}/book`), "after signing in she is back on the booking page");
  await caption(c.page, W.captions.dog);
  await c.page.getByRole("button", { name: W.addAnother }).click();
  await c.page.getByLabel(W.dogName, { exact: true }).fill("Miso");
  await c.page.getByLabel(W.breed).fill("Shiba inu");
  await c.page.getByLabel(W.size).selectOption({ index: 1 });
  await c.page.getByLabel(W.temperament).fill(LOCALE === "fr" ? "Curieux, adore les autres chiens" : "Curious, loves other dogs");
  await beat(c.page, 700);
  await c.page.getByRole("button", { name: W.addDog }).click();
  await c.page.getByRole("checkbox", { name: "Miso" }).waitFor();
  check(true, "the second dog is on the file");
  await caption(c.page, W.captions.pick);
  await c.page.getByLabel(W.service).selectOption({ index: 2 }); // the group walk
  await c.page.getByLabel(W.zone).selectOption({ index: 0 });
  await c.page.getByRole("checkbox", { name: "Tofu" }).check();
  await c.page.getByRole("checkbox", { name: "Miso" }).check();
  await c.page.getByRole("radio").first().waitFor();
  const joins = c.page.getByRole("radio").filter({ hasText: /\d.*5/ });
  const slot = (await joins.count()) > 0 ? joins.first() : c.page.getByRole("radio").first();
  await slot.scrollIntoViewIfNeeded();
  const slotLabel = (await slot.innerText()).replace(/\s+/g, " ");
  await slot.click();
  await beat(c.page, 900);
  await c.page.screenshot({ path: path.join(OUT, "02-booking.png") });
  await c.page.getByRole("button", { name: W.confirm }).click();
  await c.page.getByText(W.done).waitFor();
  await caption(c.page, W.captions.booked);
  check(true, `booked: ${slotLabel}`);
  await beat(c.page, 1500);
  await close(c);

  // 2 — the walker: her day, check-in/out, the report with a photo, sent.
  const w = await open(browser, "2-walker");
  await w.page.goto(`${BASE}/${LOCALE}/sign-in`);
  await signIn(w.page, walker);
  await w.page.getByRole("link", { name: W.next }).first().waitFor();
  await w.page.waitForLoadState("networkidle");
  await caption(w.page, W.captions.walker);
  await beat(w.page, 1200);
  // Find the day that holds the walk: step forward until a card shows Sofia's dogs.
  for (let i = 0; i < 8 && (await w.page.getByText("Miso").count()) === 0; i++) {
    await w.page.getByRole("link", { name: W.next }).first().click();
    await w.page.waitForLoadState("networkidle");
    await beat(w.page, 600);
  }
  check((await w.page.getByText("Miso").count()) > 0, "the walker sees the new booking on her day view");
  const card = w.page.locator("[aria-labelledby^=visit-]").filter({ hasText: "Miso" }).first();
  await card.scrollIntoViewIfNeeded();
  await beat(w.page, 1500);
  await w.page.screenshot({ path: path.join(OUT, "03-walker-day.png") });
  await caption(w.page, W.captions.start);
  await card.getByRole("button", { name: W.checkIn }).click();
  await card.getByRole("button", { name: W.checkOut }).waitFor();
  await beat(w.page, 1200);
  await caption(w.page, W.captions.end);
  await card.getByRole("button", { name: W.checkOut }).click();
  await card.getByRole("form", { name: W.reportTitle("Miso") }).waitFor();
  await caption(w.page, W.captions.report);
  // A photo for the report: an illustration drawn on the spot (a demo, not a stock picture of someone's dog).
  const photo = await w.page.evaluate(() => {
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
  for (const dog of ["Tofu", "Miso"]) {
    const box = card.getByRole("form", { name: W.reportTitle(dog) });
    await box.getByLabel(W.note).fill(LOCALE === "fr" ? `${dog} a bien marché, 45 min autour du canal Lachine, pipi ✓` : `${dog} walked well, 45 min along the Lachine canal, pee ✓`);
    await box.locator("input[type=file]").setInputFiles(photoPath);
    await box.getByRole("button", { name: W.save }).click();
    await box.getByText(W.saved).waitFor();
    check(true, `the report for ${dog} is saved with its photo`);
  }
  await beat(w.page, 800);
  await w.page.screenshot({ path: path.join(OUT, "04-walker-report.png") });
  await caption(w.page, W.captions.sent);
  const send = card.getByRole("form", { name: W.reportTitle("Miso") }).getByRole("button", { name: W.send("Sofia") });
  await send.scrollIntoViewIfNeeded();
  await send.click();
  await card.getByRole("form", { name: W.reportTitle("Miso") }).getByText(W.afterSend).waitFor();
  check(true, "the report was sent (or queued when no mail provider is set)");
  await beat(w.page, 2200);
  await close(w);

  // 3 — the client again: the report in her space.
  const r = await open(browser, "3-client-report");
  await r.page.goto(`${BASE}/${LOCALE}/sign-in`);
  await signIn(r.page, client);
  await r.page.getByRole("heading", { level: 1 }).waitFor();
  await caption(r.page, W.captions.client);
  const reportImage = r.page.locator("img[src*='/api/me/reports/']").first();
  await reportImage.waitFor();
  await reportImage.scrollIntoViewIfNeeded();
  const loaded = await r.page.waitForFunction((img) => img.complete && img.naturalWidth > 0, await reportImage.elementHandle(), { timeout: 10_000 }).then(() => true, () => false);
  check(loaded, "the photo of the report loads in her space");
  await beat(r.page, 2500);
  await r.page.screenshot({ path: path.join(OUT, "05-client-report.png") });
  await close(r);
} finally {
  await browser.close();
  writeFileSync(path.join(OUT, "journey.json"), JSON.stringify({ base: BASE, locale: LOCALE, calls }, null, 2));
}
const failedCalls = calls.filter((x) => x.status >= 500);
check(failedCalls.length === 0, "no API call answered with a server error");
check(calls.every((x) => x.requestId), "every API call carries a request id");
process.stdout.write(`${calls.length} API calls recorded in ${path.join(OUT, "journey.json")}\n`);
if (VIDEO) process.stdout.write(`videos: ${readdirSync(path.join(OUT, "video")).join(", ")}\n`);
process.exit(failed ? 1 : 0);

#!/usr/bin/env node
// End-to-end of the booking path for a client who has no account (krizaka-internal#1909), in a real browser, on a phone: an anonymous
// visitor opens a shop, picks a service and a free time, gives their details at the last step (no sign-in wall), receives the 6-digit code
// by e-mail, types it, and lands on the receipt — « You are booked », when, with whom, where, the price — signed in without a password.
// It films the whole run (one video, from the first meaningful frame) and can take a capture of each step in both themes.
//
// The test mailbox is a tiny Mailgun look-alike this script starts: the deployment under test must send its mail there, e.g.
//   MAIL_PROVIDER=mailgun MAIL_API_KEY=e2e MAIL_DOMAIN=mg.e2e.test MAIL_API_URL=http://127.0.0.1:3299 pnpm dev
// (and no ABUSE_CAPTCHA_* outside production, or the widget's test keys). Then:
//
//   E2E_BASE=http://localhost:3210 E2E_SLUG=<a published shop> [E2E_LOCALE=fr] [E2E_OUT=<dir>] [E2E_MAIL_PORT=3299] pnpm run e2e:guest
//
// Needs a Chromium for playwright-core. It adds one client file and one booking at that shop under an `@akinaza.test` address: demo data only.
import { mkdirSync, renameSync, readdirSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";

const { chromium } = createRequire(import.meta.url)("playwright-core");
const BASE = (process.env.E2E_BASE ?? "http://localhost:3210").replace(/\/$/, "");
const LOCALE = process.env.E2E_LOCALE === "fr" ? "fr" : "en";
const SLUG = process.env.E2E_SLUG ?? "pattes-saint-henri";
const OUT = process.env.E2E_OUT;
const MAIL_PORT = Number(process.env.E2E_MAIL_PORT ?? 3299);
const EMAIL = `e2e-guest-${Date.now()}@akinaza.test`;
if (OUT) mkdirSync(OUT, { recursive: true });

// The words of the interface, in the language of the run (messages/<locale>.json, `console.guest` and `console.journey`).
const W = {
  en: { name: "Your name", email: "E-mail", phone: "Phone", consent: /^I agree that/, send: "Send me the code", code: "Code", confirm: "Confirm my booking", booked: "You are booked", dog: "Name" },
  fr: { name: "Votre nom", email: "Courriel", phone: "Téléphone", consent: /^J'accepte que/, send: "M'envoyer le code", code: "Code", confirm: "Confirmer ma réservation", booked: "C'est réservé", dog: "Nom" },
}[LOCALE];
const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failures.push(what);
};

// The test mailbox: the provider's « send a message » call, kept in memory (never logged: it holds a code).
const mails = [];
const mailbox = createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    const form = new URLSearchParams(body);
    mails.push({ to: form.get("to") ?? "", text: form.get("text") ?? "" });
    res.writeHead(200, { "content-type": "application/json" }).end("{}");
  });
});
await new Promise((resolve) => mailbox.listen(MAIL_PORT, "127.0.0.1", resolve));
const codeFor = async (to) => {
  for (let i = 0; i < 60; i += 1) {
    const code = /\b(\d{6})\b/.exec(mails.filter((m) => m.to === to).at(-1)?.text ?? "")?.[1];
    if (code) return code;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
};

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: LOCALE === "fr" ? "fr-CA" : "en-CA",
  ...(OUT ? { recordVideo: { dir: path.join(OUT, "video"), size: { width: 390, height: 844 } } } : {}),
});
const page = await context.newPage();
const shoot = async (name) => {
  if (!OUT) return;
  for (const theme of ["dark", "light"]) {
    await page.evaluate((t) => {
      localStorage.setItem("kz-theme", t);
      document.documentElement.classList.toggle("light", t === "light");
    }, theme);
    await page.screenshot({ path: path.join(OUT, `${name}-${theme}-${LOCALE}.png`) });
  }
};
const beat = (ms = 1200) => page.waitForTimeout(ms); // each step readable for a second in the film

try {
  // 1. An anonymous visitor opens the shop, a service, its times, and picks one.
  await page.goto(`${BASE}/${LOCALE}/s/${SLUG}`, { waitUntil: "networkidle" });
  await beat();
  await page.locator('a[href*="/service/"]').first().click();
  await page.waitForURL(/\/service\/[^/?]+(\?.*)?$/);
  await shoot("1-service");
  await beat();
  await page.locator('a[href*="/slots"]').first().click();
  await page.waitForURL(/\/slots/);
  await beat();
  await page.locator('a[href*="/confirm?"]').first().click();

  // 2. The last step is the guest step, not the owner sign-in.
  await page.waitForURL(/\/confirm\?/);
  check(!page.url().includes("/sign-in"), "an anonymous visitor is not sent to the sign-in");
  await page.locator("[data-guest-summary]").waitFor();
  check((await page.locator("[data-guest-summary]").innerText()).trim().length > 0, "the time and the price are shown before anything is asked");
  check((await page.locator("[data-guest-cancel-rule]").count()) === 1, "the cancellation rule is shown before booking");
  await shoot("2-details");

  // 3. Details, the consent line (never pre-ticked), the code by e-mail.
  const consent = page.getByRole("checkbox", { name: W.consent });
  check(!(await consent.isChecked()), "the consent box is not pre-ticked");
  await page.getByLabel(W.name, { exact: true }).fill("Camille Roy");
  await page.getByLabel(W.email, { exact: true }).fill(EMAIL);
  await page.getByLabel(W.phone, { exact: true }).fill("514-555-0100");
  const dog = page.getByLabel(W.dog, { exact: true });
  if (await dog.count()) await dog.fill("Miso");
  await consent.check();
  await beat();
  await page.getByRole("button", { name: W.send }).click();
  const code = await codeFor(EMAIL);
  check(!!code, "the code arrives by e-mail");
  await page.getByLabel(W.code, { exact: true }).waitFor();
  await shoot("3-code");

  // 4. The code books and signs in: the receipt.
  await beat();
  await page.getByLabel(W.code, { exact: true }).fill(code ?? "000000");
  await page.getByRole("button", { name: W.confirm }).click();
  await page.waitForURL(/\/confirmation\?booking=/);
  await page.locator("[data-booked-stamp]").waitFor();
  check((await page.getByText(W.booked).count()) > 0, "the receipt says the visitor is booked");
  check((await page.locator('a[href$="/calendar"]').count()) > 0, "the receipt offers the calendar");
  await shoot("4-receipt");
  await beat(2000);
} finally {
  await context.close();
  await browser.close();
  mailbox.close();
}

if (OUT) {
  // The film keeps a readable name.
  const dir = path.join(OUT, "video");
  const webm = readdirSync(dir).find((f) => f.endsWith(".webm"));
  if (webm) renameSync(path.join(dir, webm), path.join(dir, `guest-booking-${LOCALE}.webm`));
}
if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nthe guest booking path works end to end");

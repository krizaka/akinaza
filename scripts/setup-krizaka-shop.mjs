#!/usr/bin/env node
// Krizaka sets up its own page in Akinaza (akinaza#489), THROUGH THE OWNER CONSOLE like any client: the same forms a client fills, driven by a browser.
// No seed, no back door, no database access: the owner account is the one an operator provisioned (sign-up is closed).
//
//   E2E_BASE=https://www.akinaza.com E2E_EMAIL=… E2E_PASSWORD=… MEDIA_DIR=<folder with the files of PHOTOS and LOGO> \
//     node scripts/setup-krizaka-shop.mjs [--slug krizaka] [--shop <id of a shop already opened>]
//
// Credentials stay in the environment and are never printed. Idempotent for the texts, contact, logo and photos; an offer already on the page is left alone.
import { createRequire } from "node:module";
import path from "node:path";

import { LOGO, OFFERS, PHOTOS, SHOP } from "./lib/krizaka-shop.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");
const args = process.argv.slice(2);
const flag = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const env = process.env;
const need = (n) => {
  if (!env[n]) throw new Error(`${n} is required`);
  return env[n];
};
const BASE = (env.E2E_BASE ?? "http://localhost:3000").replace(/\/$/, "");
const MEDIA = path.resolve(need("MEDIA_DIR"));
const slug = flag("slug", SHOP.slug);
const log = (m) => process.stdout.write(`${m}\n`);

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const signIn = () => context.request.post(`${BASE}/api/auth/sign-in`, { data: { email: need("E2E_EMAIL"), password: need("E2E_PASSWORD") } });
let res = await signIn();
// The sign-in is rate-limited (429 + Retry-After): wait it out rather than hammer it.
for (let tries = 0; res.status() === 429 && tries < 6; tries++) {
  await new Promise((r) => setTimeout(r, (Number(res.headers()["retry-after"]) || 60) * 1000 + 2000));
  res = await signIn();
}
if (!res.ok()) throw new Error(`sign-in refused (${res.status()})`);
const page = await context.newPage();
const refusals = [];
page.on("response", (r) => {
  if (r.url().includes("/api/") && r.request().method() !== "GET" && r.status() >= 400) refusals.push(`${r.status()} ${new URL(r.url()).pathname}`);
});

/** The shop's id: the one given, or the shop the owner already has, or a new one opened from the form. */
async function shopId() {
  if (flag("shop")) return flag("shop");
  await page.goto(`${BASE}/en/app`, { waitUntil: "load" });
  const existing = new URL(page.url()).pathname.match(/\/app\/([0-9a-f-]{36})/)?.[1];
  if (existing) return existing;
  await page.goto(`${BASE}/en/app/open-shop`, { waitUntil: "load" });
  await page.getByLabel("Shop name").fill(SHOP.name);
  await page.getByLabel("Type of business").selectOption({ index: 0 });
  await page.getByLabel("Legal name").fill(SHOP.legalName);
  await page.getByLabel("Your first name").fill(SHOP.ownerName);
  await page.getByLabel("Address", { exact: true }).fill(SHOP.address);
  await page.getByLabel("Page address").fill(slug);
  await page.getByRole("button", { name: "Create the shop" }).click();
  await page.waitForURL(/\/app\/[0-9a-f-]{36}\//, { timeout: 30_000 });
  return new URL(page.url()).pathname.match(/\/app\/([0-9a-f-]{36})/)[1];
}

const id = await shopId();
const tab = async (name) => {
  await page.goto(`${BASE}/en/app/${id}/settings/page?tab=${name}`, { waitUntil: "load" });
  await page.waitForTimeout(600);
};
const save = async (label) => {
  await page.getByRole("button", { name: /^(Save this section|Save the photos|Save the rules)$/ }).first().click();
  await page.waitForTimeout(1200);
  log(`saved: ${label}`);
};

await tab("texts");
await page.getByLabel("One line, in French").fill(SHOP.taglineFr);
await page.getByLabel("One line, in English").fill(SHOP.taglineEn);
await page.getByLabel("Who you are (French)").fill(SHOP.bioFr);
await page.getByLabel("Who you are (English)").fill(SHOP.bioEn);
await page.getByLabel("What a seat is called (French)").fill(SHOP.seatUnitFr);
await page.getByLabel("What a seat is called (English)").fill(SHOP.seatUnitEn);
await save("texts");

await tab("contact");
await page.getByLabel("Address", { exact: true }).fill(SHOP.address);
await page.getByLabel("Locality shown on the page").fill(SHOP.area);
await page.getByLabel("E-mail shown to visitors").fill(SHOP.publicEmail);
await save("contact");

await tab("offer");
for (const o of OFFERS) {
  if (await page.getByText(o.nameEn, { exact: true }).count()) {
    log(`offer already there: ${o.nameEn}`);
    continue;
  }
  await page.getByLabel("Name, in French").fill(o.nameFr);
  await page.getByLabel("Name, in English").fill(o.nameEn);
  await page.getByLabel("Minutes").fill(String(o.durationMinutes));
  await page.getByLabel("Price (before taxes)").fill("0");
  await page.getByLabel("Sentence (French)").fill(o.descriptionFr);
  await page.getByLabel("Sentence (English)").fill(o.descriptionEn);
  await page.getByLabel("What is included (French)").fill(o.includedFr.join("\n"));
  await page.getByLabel("What is included (English)").fill(o.includedEn.join("\n"));
  const varies = page.getByLabel(/^The price varies/);
  if ((await varies.isChecked()) !== o.priceVaries) await varies.click();
  await page.getByRole("button", { name: "Add the service" }).click();
  await page.getByText(o.nameEn, { exact: true }).first().waitFor({ timeout: 15_000 });
  log(`offer: ${o.nameEn}`);
}

await tab("look");
await page.locator('input[type="file"]').first().setInputFiles(path.join(MEDIA, LOGO.file));
await page.getByRole("button", { name: "Upload logo" }).click();
await page.waitForTimeout(2500);
log("logo");

await tab("media");
const cover = PHOTOS.find((p) => p.cover);
await page.locator('input[type="file"]').first().setInputFiles(path.join(MEDIA, cover.file));
await page.waitForTimeout(3000);
await page.getByLabel("Cover description (French)").fill(cover.altFr);
await page.getByLabel("Cover description (English)").fill(cover.altEn);
const gallery = PHOTOS.filter((p) => !p.cover);
for (const p of gallery) {
  await page.locator('input[type="file"]').nth(1).setInputFiles(path.join(MEDIA, p.file));
  await page.waitForTimeout(3000);
}
// The gallery is one line per picture: `address | alt (fr) | alt (en) | caption (fr) | caption (en)`; the uploads gave the addresses, the alt texts are completed here.
const box = page.getByLabel("Gallery");
const lines = (await box.inputValue()).split("\n").filter(Boolean);
await box.fill(lines.map((line, i) => [line.split("|")[0].trim(), gallery[i]?.altFr ?? "", gallery[i]?.altEn ?? "", gallery[i]?.captionFr ?? "", gallery[i]?.captionEn ?? ""].join(" | ").replace(/( \| )+$/, "")).join("\n"));
await save("photos");

await tab("publish");
if (!(await page.getByLabel("Publish the page").isChecked())) await page.getByLabel("Publish the page").click();
await save("publish");

log(`shop ${id}`);
log(refusals.length ? `refusals: ${refusals.join(", ")}` : "no refusal");
await browser.close();

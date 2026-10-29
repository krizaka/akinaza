#!/usr/bin/env node
// The web showcase journeys of the download page (krizaka/.github#315): short recordings made by the e2e job itself, so the videos follow
// the product. Two journeys on the CI backend (scripts/ci-mobile-backend.sh: the demo shops and the fictional Saint-Henri walker, Léa):
//   web-storefront  a demo shop's public page, then « Voir autrement »: the same shop in other compositions of Krizaka UI.
//   web-composer    the owner's composer (Boutique > Page): a section moved with the keyboard, the style changed. Nothing is published.
// Demo data only. The sign-in is made OFF camera (nothing typed is filmed), any e-mail on screen is hidden, the dev banner stays visible.
//
//   node apps/web/scripts/showcase-web.mjs <out-dir> [--base http://localhost:3000] [--locale fr|en] [--slug cedre-ciseaux]
//   (the persona comes from the environment: E2E_EMAIL and E2E_PASSWORD, the seeded demo one, never a real account)
//
// Writes <out-dir>/web-storefront.webm and web-composer.webm (no audio), ready for the app-videos action.
import { mkdirSync, renameSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const outDir = path.resolve(args[0] ?? "showcase-web");
const base = flag("base", "http://localhost:3000");
const locale = flag("locale", "fr");
const slug = flag("slug", "cedre-ciseaux");
const persona = process.env.E2E_EMAIL;
const secret = process.env.E2E_PASSWORD;
if (!persona || !secret) throw new Error("E2E_EMAIL and E2E_PASSWORD are required (the seeded persona, never a real account)");
mkdirSync(outDir, { recursive: true });

const VIEWPORT = { width: 1280, height: 800 };
const W =
  locale === "fr"
    ? { email: "Courriel", field: "Mot de passe", signIn: "Se connecter", sections: "Sections", style: "Allure", looks: "Voir autrement" }
    : { email: "E-mail", field: "Password", signIn: "Sign in", sections: "Sections", style: "Style", looks: "See it another way" };
const browser = await chromium.launch();

/** Hides any element that shows an e-mail address: nothing personal on screen. */
const hideEmail = () => {
  const hide = () => {
    for (const el of document.querySelectorAll("body *")) {
      if (el.childElementCount === 0 && /@[a-z0-9.-]+\.[a-z]{2,}/i.test(el.textContent ?? "")) el.style.visibility = "hidden";
    }
  };
  document.addEventListener("DOMContentLoaded", () => {
    hide();
    new MutationObserver(hide).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
};

/** The signed-in state, made off camera, with the shop's id (from the address after sign-in). */
async function session() {
  const ctx = await browser.newContext({ viewport: VIEWPORT, colorScheme: "dark", locale });
  const page = await ctx.newPage();
  await page.goto(`${base}/${locale}/sign-in`, { waitUntil: "networkidle" });
  await page.getByLabel(W.email).fill(persona);
  await page.getByLabel(W.field).fill(secret);
  await page.getByRole("button", { name: W.signIn }).click();
  await page.waitForURL(/\/app\/[0-9a-f-]{36}/, { timeout: 60_000 });
  const shopId = page.url().match(/\/app\/([0-9a-f-]{36})/)[1];
  const state = await ctx.storageState();
  await ctx.close();
  return { state, shopId };
}

/** One journey = one context = one video; the file is renamed <id>.webm in the out directory. */
async function record(id, act, storageState) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, colorScheme: "dark", locale, storageState, recordVideo: { dir: outDir, size: VIEWPORT } });
  await ctx.addInitScript(hideEmail);
  const page = await ctx.newPage();
  await act(page);
  await page.waitForTimeout(1500);
  const video = page.video();
  await ctx.close();
  renameSync(await video.path(), path.join(outDir, `${id}.webm`));
  process.stdout.write(`recorded ${id}\n`);
}

await record("web-storefront", async (page) => {
  await page.goto(`${base}/${locale}/s/${slug}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.mouse.wheel(0, 520);
  await page.waitForTimeout(1600);
  const nav = page.getByRole("navigation", { name: W.looks });
  if (!(await nav.count())) throw new Error(`no « ${W.looks} » on /${slug}: the demo shops are not seeded`);
  await nav.scrollIntoViewIfNeeded();
  for (const look of ["editorial", "gallery"]) {
    const link = nav.locator(`[data-look="${look}"]`);
    if (!(await link.count())) continue;
    await link.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2200);
    await page.mouse.wheel(0, 360);
    await page.waitForTimeout(1400);
  }
});

const { state, shopId } = await session();
await record(
  "web-composer",
  async (page) => {
    await page.goto(`${base}/${locale}/app/${shopId}/settings/page?tab=composer`, { waitUntil: "networkidle" });
    const sections = page.getByRole("navigation", { name: W.sections, exact: true });
    await sections.waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1800);
    // Move a section down with the keyboard (Alt+ArrowDown), as the composer's own journey does; then another style.
    await sections.getByRole("listitem").nth(1).getByRole("button").first().focus();
    await page.waitForTimeout(500);
    await page.keyboard.press("Alt+ArrowDown");
    await page.waitForTimeout(1800);
    const picker = page.getByLabel(W.style);
    const other = await picker.evaluate((el) => [...el.options].map((o) => o.value).find((v) => v !== el.value)).catch(() => undefined);
    if (other) await picker.selectOption(other);
    await page.waitForTimeout(2600);
  },
  state,
);

await browser.close();

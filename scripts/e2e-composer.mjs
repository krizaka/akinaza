#!/usr/bin/env node
// End-to-end journey of the shop page composer (Akinaza#427) on a running deployment, in a real browser, as a shop owner on the
// dev fixtures: open Boutique > Page > Composer, reorder a section with Alt+ArrowDown, change the style, and check that the autosave
// stored the draft; publish and check the PUBLIC page changed; roll back and check the public page AND the draft are restored; make
// another edit and discard it, and check the draft equals the published page. It also runs the "never overflows" containment check
// (the page has no horizontal scroll) on a phone and on a desktop width, dark and light.
//
//   E2E_BASE=https://dev.akinaza.com E2E_OWNER_EMAIL=... E2E_OWNER_PASS=... [E2E_SLUG=pattes-saint-henri] [E2E_LOCALE=fr] [E2E_OUT=<dir>] pnpm run e2e:composer
//
// It publishes two versions of the shop's page: run it on a demo or throw-away shop, never on someone's real page. Secrets stay in
// the environment; nothing but the checks is printed. It needs a Chromium for playwright-core.
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const BASE = (process.env.E2E_BASE ?? "http://localhost:3210").replace(/\/$/, "");
const LOCALE = process.env.E2E_LOCALE === "en" ? "en" : "fr";
const SLUG = process.env.E2E_SLUG ?? "pattes-saint-henri";
const OUT = process.env.E2E_OUT ?? "e2e-composer-out";
const need = (name) => {
  if (!process.env[name]) throw new Error(`${name} is required`);
  return process.env[name];
};
const who = { email: need("E2E_OWNER_EMAIL"), secret: need("E2E_OWNER_PASS") };
const W = {
  fr: { email: "Courriel", secret: "Mot de passe", signIn: "Se connecter", sections: "Sections", style: "Allure", publish: "Publier", discard: "Abandonner le brouillon", discardYes: "Oui, annuler", restore: "Restaurer", history: "Historique" },
  en: { email: "E-mail", secret: "Password", signIn: "Sign in", sections: "Sections", style: "Style", publish: "Publish", discard: "Discard the draft", discardYes: "Yes, discard", restore: "Restore", history: "History" },
}[LOCALE];

mkdirSync(OUT, { recursive: true });
let failed = 0;
const check = (ok, what) => {
  process.stdout.write(`${ok ? "ok  " : "FAIL"} ${what}\n`);
  if (!ok) failed += 1;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, what, ms = 15000) => {
  const end = Date.now() + ms;
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() > end) throw new Error(`timeout: ${what}`);
    await sleep(250);
  }
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: LOCALE === "fr" ? "fr-CA" : "en-CA", timezoneId: "America/Toronto" });
const page = await context.newPage();
const api = async (route, init) => {
  // The studio's own calls, as its page makes them: a browser says `Sec-Fetch-Site: same-origin`, which the API's write check (lib/csrf.ts) asks of a request that carries the session.
  const res = await context.request.fetch(`${BASE}${route}`, { ...init, headers: { "sec-fetch-site": "same-origin", ...init?.headers } });
  return { status: res.status(), body: (res.headers()["content-type"] ?? "").includes("json") ? await res.json() : await res.text() };
};
const orderOf = (doc) => doc.sections.map((s) => s.key);
const draftDoc = async () => (await api("/api/walker/page/draft")).body;
/** What the public page draws: the sections in order, and the style id. */
const publicView = async (slug) => {
  const html = String((await api(`/${LOCALE}/s/${slug}`)).body);
  return { sections: [...html.matchAll(/data-shop-key="([^"]+)"/g)].map((m) => m[1]).join(), preset: html.match(/data-shop-preset="([^"]+)"/)?.[1] ?? "" };
};

try {
  // 1 - sign in as the owner and open the composer.
  await page.goto(`${BASE}/${LOCALE}/sign-in`);
  await page.getByLabel(W.email).fill(who.email);
  await page.getByLabel(W.secret).fill(who.secret);
  await page.getByRole("button", { name: W.signIn }).click();
  await page.waitForURL(/\/app\/[0-9a-f-]{36}/);
  const shopId = page.url().match(/\/app\/([0-9a-f-]{36})/)[1];
  const composerUrl = `${BASE}/${LOCALE}/app/${shopId}/boutique/page?tab=composer`;
  const slug = SLUG;

  // Start clean: nothing pending, so the draft is the page.
  await api("/api/walker/page/discard", { method: "POST" });
  // A baseline: the current page is published, so the next publication archives it (the version to roll back to).
  const first = await draftDoc();
  await api("/api/walker/page/draft", { method: "PUT", data: first.page });
  await api("/api/walker/page/publish", { method: "POST" });
  const start = await draftDoc();
  const startOrder = orderOf(start.page);
  const startPreset = start.page.preset.id;
  check(start.draft === false, "the journey starts with no draft");
  await page.goto(composerUrl);
  const sectionsNav = page.getByRole("navigation", { name: W.sections, exact: true });
  await sectionsNav.waitFor();
  check((await sectionsNav.getByRole("listitem").count()) === startOrder.length, "the composer lists the page's sections");

  // 2 - reorder with the keyboard, change the style: the autosave stores the draft.
  // The page is drawn by the server first: a key or a choice before React has taken it over does nothing (the CI flake of #515). Wait for the takeover.
  const firstButton = await sectionsNav.getByRole("button").first().elementHandle();
  await page.waitForFunction((el) => Object.keys(el).some((k) => k.startsWith("__reactProps$")), firstButton);
  await sectionsNav.getByRole("listitem").nth(1).getByRole("button").first().focus();
  await page.keyboard.press("Alt+ArrowDown");
  const picker = page.getByLabel(W.style);
  const other = await picker.evaluate((el, current) => [...el.options].map((o) => o.value).find((v) => v !== current), startPreset);
  if (other) await picker.selectOption(other);
  const stored = await until(async () => {
    const d = await draftDoc();
    return d.draft && (!other || d.page.preset.id === other) && orderOf(d.page).join() !== startOrder.join() ? d : null;
  }, "the autosave stores the draft").catch(() => null);
  check(!!stored, "the autosave stored a draft");
  const movedOrder = stored ? orderOf(stored.page) : [];
  if (process.env.E2E_DEBUG) process.stdout.write(`${startOrder.join()} -> ${movedOrder.join()}\n`);
  check(movedOrder[2] === startOrder[1] && movedOrder[1] === startOrder[2], "the draft has the section moved down with Alt+ArrowDown");
  check(!other || stored?.page.preset.id === other, "the draft has the new style");
  await page.screenshot({ path: path.join(OUT, "01-draft-desktop.png") });

  // 3 - publish: the public page changes.
  const before = await publicView(slug);
  await page.getByRole("button", { name: W.publish, exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: W.publish, exact: true }).click();
  const published = await until(async () => {
    const d = await draftDoc();
    return d.draft === false && orderOf(d.page).join() === movedOrder.join() ? d : null;
  }, "the page is published").catch(() => null);
  check(!!published, "publishing makes the draft the page");
  const changed = await until(async () => {
    const v = await publicView(slug);
    return v.sections !== before.sections || v.preset !== before.preset ? v : null;
  }, "the public page changes").catch(() => null);
  check(!!changed, "the public page changed after publishing");

  // 4 - the owner edits again (a pending draft), then rolls back to the older version: the public page AND the draft are restored.
  const edited = { ...published.page, sections: [published.page.sections[0], ...published.page.sections.slice(1).reverse()] };
  check((await api("/api/walker/page/draft", { method: "PUT", data: edited })).status === 200, "the owner has a pending draft before restoring");
  await page.goto(composerUrl);
  await page.getByText(W.history, { exact: true }).click();
  await page.getByRole("button", { name: W.restore, exact: true }).first().click();
  const restored = await until(async () => {
    const d = await draftDoc();
    return d.draft === false ? d : null;
  }, "the rollback resets the draft").catch(() => null);
  check(!!restored && orderOf(restored.page).join() === startOrder.join(), "after the rollback the draft is the restored page, not the earlier edit");
  const rolled = await publicView(slug);
  check(rolled.sections === before.sections && rolled.preset === before.preset, "after the rollback the public page is the restored one");

  // 5 - discard: the draft equals the published page.
  await page.goto(composerUrl);
  await sectionsNav.getByRole("listitem").nth(1).getByRole("button").first().focus();
  await page.keyboard.press("Alt+ArrowDown");
  await until(async () => (await draftDoc()).draft, "a new draft is stored").catch(() => undefined);
  await page.getByRole("button", { name: W.discard }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: W.discardYes }).click();
  const equal = await until(async () => {
    const d = await draftDoc();
    return d.draft === false ? d : null;
  }, "the draft is discarded").catch(() => null);
  check(!!equal && orderOf(equal.page).join() === startOrder.join(), "after discarding, the draft equals the published page");
  await until(async () => (await page.getByRole("alertdialog").count()) === 0, "the confirmation closes").catch(() => undefined);
  check((await page.getByRole("alertdialog").count()) === 0, "the composer shows the published page again");

  // 6 - never overflows: no horizontal scroll, dark and light, phone and desktop.
  for (const [name, viewport] of [["phone", { width: 390, height: 844 }], ["desktop", { width: 1440, height: 1000 }]]) {
    for (const scheme of ["dark", "light"]) {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(composerUrl);
      await sectionsNav.waitFor().catch(() => undefined);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(overflow <= 0, `the console never overflows (${name}, ${scheme})`);
      await page.screenshot({ path: path.join(OUT, `02-composer-${name}-${scheme}.png`) });
    }
  }
} catch (error) {
  failed += 1;
  process.stdout.write(`FAIL ${error instanceof Error ? error.message : String(error)}\n`);
  await page.screenshot({ path: path.join(OUT, "failure.png") }).catch(() => undefined);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);

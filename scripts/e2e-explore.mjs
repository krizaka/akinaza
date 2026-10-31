#!/usr/bin/env node
// End-to-end of Explorer's filters (akinaza#575) on a running deployment, in a real browser, as a visitor on her phone: she opens
// Explorer, narrows by kind, types a name, shares the link, goes back and forward, and clears everything. The address is the state
// (kind, q, near, view), the typed text makes one request, and the page never shifts. Optionally takes a capture of each step in
// both themes. It reads public pages only: no account, nothing written.
//
//   E2E_BASE=https://dev.akinaza.com [E2E_LOCALE=fr] [E2E_OUT=<dir>] pnpm run e2e:explore
//
// Needs a Chromium for playwright-core (PLAYWRIGHT_BROWSERS_PATH or the default cache).
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { makeShoot } from "./e2e-shoot.mjs";

const { chromium } = createRequire(import.meta.url)("playwright-core");
const BASE = (process.env.E2E_BASE ?? "http://localhost:3210").replace(/\/$/, "");
const LOCALE = process.env.E2E_LOCALE === "fr" ? "fr" : "en";
const OUT = process.env.E2E_OUT;
if (OUT) mkdirSync(OUT, { recursive: true });

// The words of the interface, in the language of the run (the same strings as messages/<locale>.json, `explore.filters`).
const W = { en: { clearAll: "Clear all", text: "Name or service", kind: "Kind of service", salons: "Salons", remove: /^Remove/ }, fr: { clearAll: "Tout effacer", text: "Nom ou service", kind: "Type de service", salons: "Salons", remove: /^Retirer/ } }[LOCALE];
const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failures.push(what);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: LOCALE === "fr" ? "fr-CA" : "en-CA" });
const page = await context.newPage();
await page.addInitScript(() => {
  globalThis.__shift = 0;
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      if (!e.hadRecentInput) globalThis.__shift += e.value;
    }
  }).observe({ type: "layout-shift", buffered: true });
});
const search = () => new URL(page.url()).searchParams;
const chips = (p) => p.getByRole("button", { name: W.remove }).count();
const shoot = makeShoot(page, OUT, LOCALE);

await page.goto(`${BASE}/${LOCALE}/explore`, { waitUntil: "networkidle" });
await shoot("1-open");
check((await page.locator("[data-testid=explore-list] li").count()) > 0, "the shops are listed");

// A kind, from the filter menu: it reaches the address and becomes a removable chip.
await page.getByRole("button", { name: W.kind }).click();
await page.getByRole("menuitemcheckbox", { name: W.salons }).click();
await page.keyboard.press("Escape");
await page.waitForFunction(() => new URL(location.href).searchParams.get("kind") === "salon");
check(search().get("kind") === "salon", "the kind is in the address");
check((await chips(page)) === 1, "the kind is a removable chip");
await shoot("2-kind");

// A name: one request after a pause, the text in the address.
const requests = [];
page.on("request", (r) => r.url().includes("/api/explore/shops") && requests.push(r.url()));
await page.getByRole("searchbox", { name: W.text }).pressSequentially("co", { delay: 40 });
await page.getByRole("searchbox", { name: W.text }).pressSequentially("if", { delay: 40 });
await page.waitForFunction(() => new URL(location.href).searchParams.get("q") === "coif");
await page.waitForTimeout(800); // the request leaves just after the address changes
check(requests.length === 1, `one request for the typed text, not one per key (${requests.length})`);

// The link is the search: a fresh page on the same address shows the same chips.
const second = await context.newPage();
await second.goto(page.url(), { waitUntil: "load" });
await second.getByRole("button", { name: W.remove }).first().waitFor();
check((await chips(second)) === 2, "the shared link restores the kind and the text");
await second.close();

// Back and forward keep the search; « Clear all » empties the address.
await page.goBack();
await page.goForward();
check(search().get("q") === "coif" && search().get("kind") === "salon", "back and forward keep the search");
await page.getByRole("button", { name: W.clearAll }).click();
await page.waitForFunction(() => !new URL(location.href).searchParams.has("kind") && !new URL(location.href).searchParams.has("q"));
check(!search().has("kind") && !search().has("q"), "« Clear all » empties the address");
await shoot("3-cleared");

const shift = await page.evaluate(() => globalThis.__shift);
check(shift < 0.02, `no layout shift (${shift.toFixed(4)})`);
await browser.close();
if (failures.length > 0) {
  console.error(`${failures.length} check(s) failed`);
  process.exit(1);
}

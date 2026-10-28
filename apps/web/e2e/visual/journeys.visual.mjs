// The main journeys of Akinaza, compared to their baselines (krizaka/.github#375), as the seeded cast (krizaka/.github#356:
// apps/web/scripts/seed-cast.mjs, CI-only credentials, never a real account): a client's way in (a shop's public page, a service,
// where booking starts) and the walker's own side.
import { readFileSync } from "node:fs";

import { defineJourneyTests } from "@krizaka/page-audit/visual";
import { expect, test } from "@playwright/test";

const BASE = process.env.VISUAL_BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.E2E_EMAIL ?? "lea.beaulieu@akinaza.test";
const PASSWORD = process.env.E2E_PASSWORD ?? "local-cast-password-0123";
const SHOP = "/fr/s/pattes-saint-henri";
// Rows are stamped with the day of the run: dates are masked, and the browser clock is the moment the seed finished.
const NOW = (() => {
  try {
    return readFileSync(new URL("../../../../.visual-now", import.meta.url), "utf8").trim();
  } catch {
    return undefined;
  }
})();
// Times and free slots follow the day; the map's tiles come from the network, so the map itself is masked.
const LIVE = ["time", "[data-live]", ".maplibregl-map"];

/** Signs in through the form, as a person would; the session cookie is kept for the signed-in captures. */
async function signIn(page) {
  await page.goto(new URL("/fr/sign-in", BASE).toString());
  await page.locator("input[type=email]").first().fill(EMAIL);
  await page.locator("input[type=password]").first().fill(PASSWORD);
  await page.locator("form button[type=submit]").first().click();
  await page.waitForURL(/\/app(\/|\?|$)/, { timeout: 60_000 });
}

/** The first service the shop's page offers (its id is the seed's). */
async function firstService(page, { origin }) {
  await page.goto(new URL(SHOP, origin).toString());
  const href = await page.locator(`a[href*="${SHOP}/service/"]`).first().getAttribute("href");
  if (!href) throw new Error("no service on the seeded shop's page: is the cast seeded?");
  return href;
}

defineJourneyTests({
  test,
  expect,
  base: BASE,
  signIn,
  ...(NOW ? { now: NOW } : {}),
  journeys: [
    { name: "landing", path: "/fr", mask: LIVE },
    { name: "shop-page", path: SHOP, mask: LIVE },
    { name: "service-booking", path: firstService, mask: LIVE },
    { name: "sign-in", path: "/fr/sign-in" },
    { name: "walker-today", path: "/fr/app", session: true, mask: LIVE },
  ],
});

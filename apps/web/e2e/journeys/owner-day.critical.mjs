// Journey: the owner's day (krizaka-internal#1938, guard for #1907/#1908). The shop owner (the seeded cast, CI-only credentials, never a real
// account) signs in and meets her day: the home is today's appointments and ONE primary action. Demo data only.
import { expect, test } from "@playwright/test";

const EMAIL = process.env.E2E_EMAIL ?? "lea.beaulieu@akinaza.test";
const CAST_WORD = process.env.E2E_PASSWORD ?? "local-cast-password-0123";

test("owner day: sign in, today is the home, one primary action", async ({ page }) => {
  await page.goto("/fr/sign-in");
  await page.locator("input[type=email]").first().fill(EMAIL);
  await page.locator("input[type=password]").first().fill(CAST_WORD);
  await page.locator("form button[type=submit]").first().click();
  await page.waitForURL(/\/app(\/|\?|$)/, { timeout: 60_000 });
  await page.waitForLoadState("load");
  await expect(page.locator("main").first()).toBeVisible();
  // One primary action on the day, not a row of equal buttons.
  await expect(page.locator("[data-primary]")).toHaveCount(1);
  await expect(page.locator("[data-primary]").first()).toBeVisible();
  const primary = ((await page.locator("[data-primary]").first().textContent()) ?? "").trim();
  expect(primary.length, "the primary action says what it does").toBeGreaterThan(3);
});

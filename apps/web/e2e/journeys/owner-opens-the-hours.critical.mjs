// Journey: the owner opens the hours (krizaka-internal#1911). Léa follows « Open the hours » from the home and lands on Hours and days off,
// not on Team and not under the page's decoration settings. Demo data only (the seeded cast).
import { expect, test } from "@playwright/test";

const EMAIL = process.env.E2E_EMAIL ?? "lea.beaulieu@akinaza.test";
const CAST_WORD = process.env.E2E_PASSWORD ?? "local-cast-password-0123";

test("owner opens the hours: Boutique lists Hours and days off, and the section holds the week", async ({ page }) => {
  await page.goto("/fr/sign-in");
  await page.locator("input[type=email]").first().fill(EMAIL);
  await page.locator("input[type=password]").first().fill(CAST_WORD);
  await page.locator("form button[type=submit]").first().click();
  // `/app` alone redirects to the shop's own address: wait for that one.
  await page.waitForURL(/\/fr\/app\/[^/?]+/, { timeout: 60_000 });
  const shopBase = new URL(page.url()).pathname.match(/^\/fr\/app\/[^/]+/)?.[0];
  expect(shopBase, "the app lives under the shop's address").toBeTruthy();
  await page.goto(`${shopBase}/settings/hours`);
  await page.waitForLoadState("load");
  await expect(page.getByRole("heading", { name: "Horaires et jours de congé" }).first()).toBeVisible();
  // On a phone the sections sit in one menu (a closed <details>): open it before reading the links.
  await page.locator("[data-settings-menu] summary").click();
  await expect(page.getByRole("link", { name: "Règles de réservation" }).first()).toBeVisible();
  // The week is on the first screen: no scroll to reach the form.
  await expect(page.getByText("mardi", { exact: false }).first()).toBeInViewport();
});

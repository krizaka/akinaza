// Journey: subscribe from inside the app (krizaka-internal#1913, guard #1938). The owner (the seeded cast, CI-only credentials) reaches Subscription from the
// account menu in one step, finds the plans /pricing sells with their free months, and starts the free period. With the processor's test keys set
// (E2E_PAYMENTS=1, the dev deployment) the action lands on the hosted test checkout (never a real card); without them it answers honestly that payment is off.
import { expect, test } from "@playwright/test";

const EMAIL = process.env.E2E_EMAIL ?? "lea.beaulieu@akinaza.test";
const CAST_WORD = process.env.E2E_PASSWORD ?? "local-cast-password-0123";

test("an owner reaches the plans from the account menu and starts the free months", async ({ page }) => {
  await page.goto("/en/sign-in");
  await page.locator("input[type=email]").first().fill(EMAIL);
  await page.locator("input[type=password]").first().fill(CAST_WORD);
  await page.locator("form button[type=submit]").first().click();
  await page.waitForURL(/\/app(\/|\?|$)/, { timeout: 60_000 });

  await page.goto("/en/pricing");
  await page.getByRole("button", { name: "Account" }).first().click();
  await page.getByRole("menuitem", { name: "Subscription" }).click();
  await page.waitForURL(/\/app\/profile\/subscription/);

  await expect(page.getByText("No plan is on sale yet."), "Subscription never says no plan is on sale while /pricing sells one").toHaveCount(0);
  const start = page.getByRole("button", { name: /Start the free period/ }).first();
  if ((await start.count()) === 0) {
    // Already subscribed in this run's data: the page says which plan is current.
    await expect(page.getByText("Current plan")).toBeVisible();
    return;
  }
  await expect(page.getByText(/3 months free, then \$29 a month plus taxes/)).toBeVisible();
  await start.click();
  if (process.env.E2E_PAYMENTS === "1") {
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
  } else {
    await expect(page.getByText(/not available yet|Payment is not available/i)).toBeVisible();
  }
});

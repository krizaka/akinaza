// Journey: subscribe from inside the app (krizaka-internal#1913, guard #1938). The owner (the seeded cast, CI-only credentials) is led from the public
// pricing page to Subscription inside the app, where the plans /pricing sells are listed. With the processor's test keys set (E2E_PAYMENTS=1, the dev
// deployment) the free period starts on the hosted test checkout (never a real card). Without them nothing is on sale: the prices are planned, no card is asked.
import { expect, test } from "@playwright/test";

const EMAIL = process.env.E2E_EMAIL ?? "lea.beaulieu@akinaza.test";
const CAST_WORD = process.env.E2E_PASSWORD ?? "local-cast-password-0123";

test("an owner reaches the plans from the account menu and starts the free months", async ({ page }) => {
  await page.goto("/en/sign-in");
  await page.locator("input[type=email]").first().fill(EMAIL);
  await page.locator("input[type=password]").first().fill(CAST_WORD);
  await page.locator("form button[type=submit]").first().click();
  await page.waitForURL(/\/app(\/|\?|$)/, { timeout: 60_000 });

  // Signed in, the public pricing page keeps the owner inside the app: it leads to Subscription.
  await page.goto("/en/pricing");
  await page.waitForURL(/\/app\/profile\/subscription/);
  await expect(page.getByText("No plan is on sale yet."), "Subscription never says no plan is on sale while /pricing sells one").toHaveCount(0);
  await expect(page.getByText("$29", { exact: false }).first(), "the plans of /pricing are here").toBeVisible();

  if (process.env.E2E_PAYMENTS !== "1") {
    // Nothing on sale (sign-up closed, no payment provider): prices are planned, no card is asked, no button leads to a card form.
    await expect(page.getByText(/prices are planned and no card is asked/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Start the free period/ })).toHaveCount(0);
    return;
  }
  const start = page.getByRole("button", { name: /Start the free period/ }).first();
  if ((await start.count()) === 0) {
    // Already subscribed in this run's data: the page says which plan is current.
    await expect(page.getByText("Current plan").first()).toBeVisible();
    return;
  }
  await expect(page.getByText(/3 months free, then \$29 a month plus taxes/)).toBeVisible();
  await start.click();
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
});

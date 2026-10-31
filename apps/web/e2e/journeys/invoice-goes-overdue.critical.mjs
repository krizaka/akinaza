// Journey: an invoice past its terms is overdue (krizaka-internal#1912, guard #1938). The owner (the seeded cast, CI-only credentials, never a real
// account) sees on the home that some money is overdue, finds the invoice flagged « Overdue » in the list, records the payment, and it leaves both.
// Demo data only; the run's clock is fixed (APP_FIXED_NOW), the demo invoices were issued months before it under the shop's 30-day terms.
import { expect, test } from "@playwright/test";

const EMAIL = process.env.E2E_EMAIL ?? "lea.beaulieu@akinaza.test";
const CAST_WORD = process.env.E2E_PASSWORD ?? "local-cast-password-0123";
const OVERDUE_LINK = /to collect · (\d+) overdue/;

const overdueOnHome = async (page, home) => {
  await page.goto(home);
  // The home streams: read it only once its loading shape is gone, or a missing link is just a page not drawn yet.
  await expect(page.getByLabel("Loading…"), "the home has finished drawing").toHaveCount(0, { timeout: 30_000 });
  const link = page.getByRole("link", { name: OVERDUE_LINK });
  if ((await link.count()) === 0) return { link, count: 0 };
  return { link, count: Number(OVERDUE_LINK.exec((await link.first().innerText()).replace(/\s+/g, " "))[1]) };
};

test("an invoice past its terms is overdue on the home and in the list, and leaves both once paid", async ({ page }) => {
  await page.goto("/en/sign-in");
  await page.locator("input[type=email]").first().fill(EMAIL);
  await page.locator("input[type=password]").first().fill(CAST_WORD);
  await page.locator("form button[type=submit]").first().click();
  await page.waitForURL(/\/app(\/|\?|$)/, { timeout: 60_000 });
  const home = page.url();

  const before = await overdueOnHome(page, home);
  expect(before.count, "the home counts the invoices past their terms (no more « On track » for July's)").toBeGreaterThan(0);

  await before.link.first().click();
  await page.waitForURL(/\/invoices/);
  const overdueRows = page.getByRole("row").filter({ hasText: "Overdue" });
  await expect(overdueRows.first(), "the list flags an invoice past its terms").toBeVisible();
  expect(await overdueRows.count()).toBe(before.count);

  const row = overdueRows.first();
  const number = ((await row.innerText()).match(/[A-Z]+-\d{5}/) ?? [])[0];
  expect(number, "the row names its invoice").toBeTruthy();
  const pay = page.getByRole("button", { name: /\((cash|card|transfer)\)$/ }).first();
  // The payment lines live in the row's details: open them with the row's own button.
  if (!(await pay.isVisible())) await page.getByRole("button", { name: `Show the details of ${number}` }).click();
  await expect(pay).toBeVisible();
  await pay.click();

  await expect(page.getByRole("row").filter({ hasText: number }).filter({ hasText: "Overdue" }), "the paid invoice leaves « Overdue »").toHaveCount(0, { timeout: 30_000 });
  const after = await overdueOnHome(page, home);
  expect(after.count, "and the home counts one less").toBe(before.count - 1);
});

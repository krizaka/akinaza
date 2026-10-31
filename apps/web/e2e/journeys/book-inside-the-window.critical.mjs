// Journey: a time inside the cancellation window is said so (krizaka-internal#1910, guard #1938). On a phone: the list of times marks the time
// before the click, the summary then says the free window has passed, above the button that books. Demo data only; nothing is booked here.
import { expect, test } from "@playwright/test";

const SLUG = "pattes-saint-henri";

test("book inside the window: the time is labelled in the list, the summary says the window has passed", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/en/s/${SLUG}`);
  await page.locator('a[href*="/service/"]').first().click();
  await page.waitForURL(/\/service\/[^/?]+(\?.*)?$/);
  await page.locator('a[href*="/slots"]').first().click();
  await page.waitForURL(/\/slots/);
  const inside = page.locator('a[href*="/confirm?"]', { hasText: "No free cancellation" }).first();
  await expect(inside, "a time inside the window carries its label in the list").toBeVisible();
  await inside.click();
  await page.waitForURL(/\/confirm\?/);
  const rule = page.locator("[data-booking-cancel-rule]");
  await expect(rule).toContainText(/has passed/i);
  const ruleY = (await rule.boundingBox()).y;
  const sendY = (await page.getByRole("button", { name: "Send me the code" }).boundingBox()).y;
  expect(ruleY, "the rule is above the button that books").toBeLessThan(sendY);
  const width = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(width, "no sideways scroll on a phone").toBeLessThanOrEqual(0);
});

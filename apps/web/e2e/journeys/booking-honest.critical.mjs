// Journey: an honest booking, to the receipt (krizaka-internal#1938, guard for #1910). The visitor is told, BEFORE confirming, what they chose,
// what it costs with the taxes, and until when they can cancel; the receipt then says the same price and the same rule. Demo data only,
// under @akinaza.test addresses; the mail goes to the journey's own mailbox, the security check runs on Cloudflare's always-pass TEST key.
import { expect, test } from "@playwright/test";

import { testMailbox } from "./test-mailbox.mjs";

const SLUG = "pattes-saint-henri";
const MAIL_PORT = Number(process.env.E2E_MAIL_PORT ?? 3299);

const mailbox = testMailbox(MAIL_PORT);
test.beforeAll(() => mailbox.start());
test.afterAll(() => mailbox.stop());

const email = `e2e-honest-${Date.now()}@akinaza.test`;

test("an honest booking: choices carried, taxes included, the cancellation window said before, the same price on the receipt", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/en/s/${SLUG}`);
  await page.locator('a[href*="/service/"]').first().click();
  await page.waitForURL(/\/service\/[^/?]+(\?.*)?$/);
  const serviceName = (await page.locator("h1").first().innerText()).trim();
  await page.locator('a[href*="/slots"]').first().click();
  await page.waitForURL(/\/slots/);
  await page.locator('a[href*="/confirm?"]').first().click();
  await page.waitForURL(/\/confirm\?/);
  await expect(page.locator("[data-booking-summary]")).toBeVisible();
  // The service chosen is the one on the summary's page; the time is carried in the address.
  await expect(page.locator("h1").first()).toContainText(serviceName);
  expect(new URL(page.url()).searchParams.get("start"), "the chosen time is carried to the summary").not.toBeNull();
  // Taxes included: the price line goes down to the total.
  const priceLine = (await page.locator("[data-booking-price]").innerText()).replace(/\s+/g, " ");
  for (const part of ["GST", "QST", "="]) {
    expect(priceLine, "the price line shows the taxes down to the total").toContain(part);
  }
  // The cancellation window is said before the person confirms.
  const rule = page.locator("[data-booking-cancel-rule]");
  // Either the free window (N h) or, for a time already inside it, that it has passed: the rule is always said.
  await expect(rule).toContainText(/\d+ ?h|has passed/i);
  const ruleY = (await rule.boundingBox()).y;
  const sendY = (await page.getByRole("button", { name: "Send me the code" }).boundingBox()).y;
  expect(ruleY, "the rule is above the button that books").toBeLessThan(sendY);
  const ruleText = (await rule.innerText()).replace(/\s+/g, " ").trim();

  await page.getByLabel("Your name", { exact: true }).fill("Camille Roy");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Phone", { exact: true }).fill("514-555-0100");
  const dog = page.getByLabel("Name", { exact: true });
  if (await dog.count()) {
    await dog.fill("Miso");
  }
  await page.getByRole("checkbox", { name: /^I agree that/ }).check();
  await expect.poll(() => page.locator('input[name="cf-turnstile-response"]').inputValue().catch(() => ""), { timeout: 30_000 }).not.toBe("");
  await page.getByRole("button", { name: "Send me the code" }).click();
  const code = await mailbox.codeFor(email);
  expect(code, "the code arrives by e-mail").not.toBeNull();
  await page.getByLabel("Code", { exact: true }).fill(code);
  await page.getByRole("button", { name: "Confirm my booking" }).click();
  await page.waitForURL(/\/confirmation\?booking=/);

  // The receipt: the same service, the same price (taxes included) and the same rule as before the button.
  await expect(page.locator("[data-booked-stamp]")).toBeVisible();
  const receipt = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  expect(receipt).toContain(serviceName);
  expect(receipt, "the receipt repeats the price with its taxes").toContain(priceLine);
  // One source of truth: whatever the summary said about the cancellation (free window, or already passed for this time), the receipt says it too.
  expect(receipt, "the receipt repeats the summary's cancellation rule").toContain(ruleText);
});

// The receipt by e-mail waits for @krizaka/email's bookingReceipt template (krizaka-ui#924, release pending): this marker turns the build red the day it is sent.
test.fail("the receipt is e-mailed after the booking (krizaka-internal#1910)", async () => {
  const sent = await mailbox.receiptFor(email);
  expect(sent, "a receipt mail, not the code mail").toBeTruthy();
});

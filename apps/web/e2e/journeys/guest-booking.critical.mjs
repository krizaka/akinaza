// Journey: the guest booking (krizaka-internal#1934). An anonymous visitor opens a shop, picks a service and a free time, gives their details,
// receives the 6-digit code by e-mail, types it and lands on the receipt. Behind a CAPTCHA: the server runs with Cloudflare's always-pass
// TEST key (public, documented, refused when APP_ENVIRONMENT=prod: lib/captcha.ts); a second server with the always-fail test key proves
// the refusal (nothing is mailed, nothing is booked). Demo data only, under @akinaza.test addresses.
import { expect, test } from "@playwright/test";

import { testMailbox } from "./test-mailbox.mjs";

const SLUG = "pattes-saint-henri";
const MAIL_PORT = Number(process.env.E2E_MAIL_PORT ?? 3299);
const FAIL_BASE = process.env.JOURNEY_FAIL_BASE ?? "http://localhost:3001";
const W = {
  en: { name: "Your name", email: "E-mail", phone: "Phone", consent: /^I agree that/, send: "Send me the code", code: "Code", confirm: "Confirm my booking", booked: "You are booked", dog: "Name" },
  fr: { name: "Votre nom", email: "Courriel", phone: "Téléphone", consent: /^J'accepte que/, send: "M'envoyer le code", code: "Code", confirm: "Confirmer ma réservation", booked: "C'est réservé", dog: "Nom" },
};

const mailbox = testMailbox(MAIL_PORT);
const { mails, codeFor } = mailbox;
test.beforeAll(() => mailbox.start());
test.afterAll(() => mailbox.stop());

/** Shop → service → time → the guest step; returns once the details form is shown. */
async function reachGuestStep(page, base, locale) {
  await page.goto(`${base}/${locale}/s/${SLUG}`);
  await page.locator('a[href*="/service/"]').first().click();
  await page.waitForURL(/\/service\/[^/?]+(\?.*)?$/);
  await page.locator('a[href*="/slots"]').first().click();
  await page.waitForURL(/\/slots/);
  await page.locator('a[href*="/confirm?"]').first().click();
  await page.waitForURL(/\/confirm\?/);
  await expect(page.locator("[data-guest-summary]")).toBeVisible();
}

/** Cloudflare's test widget solves itself in a moment: the form can be sent once it has handed its token over. */
async function captchaSolved(page) {
  await expect.poll(() => page.locator('input[name="cf-turnstile-response"]').inputValue().catch(() => ""), { timeout: 30_000, message: "the security check hands its token over" }).not.toBe("");
}

async function fillDetails(page, locale, email) {
  const w = W[locale];
  await page.getByLabel(w.name, { exact: true }).fill("Camille Roy");
  await page.getByLabel(w.email, { exact: true }).fill(email);
  await page.getByLabel(w.phone, { exact: true }).fill("514-555-0100");
  const dog = page.getByLabel(w.dog, { exact: true });
  if (await dog.count()) await dog.fill("Miso");
  await page.getByRole("checkbox", { name: w.consent }).check();
}

for (const locale of ["en", "fr"]) {
  test(`guest booking, ${locale}: anonymous visitor to slot, e-mail code, confirmed, receipt`, async ({ page, baseURL }) => {
    const w = W[locale];
    const email = `e2e-guest-${locale}-${Date.now()}@akinaza.test`;
    await reachGuestStep(page, baseURL, locale);
    expect(page.url()).not.toContain("/sign-in");
    await expect(page.locator("[data-guest-cancel-rule]")).toHaveCount(1);
    await expect(page.getByRole("checkbox", { name: w.consent })).not.toBeChecked();
    await fillDetails(page, locale, email);
    await captchaSolved(page);
    await page.getByRole("button", { name: w.send }).click();
    const code = await codeFor(email);
    expect(code, "the code arrives by e-mail").not.toBeNull();
    await page.getByLabel(w.code, { exact: true }).fill(code);
    await page.getByRole("button", { name: w.confirm }).click();
    await page.waitForURL(/\/confirmation\?booking=/);
    await expect(page.locator("[data-booked-stamp]")).toBeVisible();
    await expect(page.getByText(w.booked).first()).toBeVisible();
    await expect(page.locator('a[href$="/calendar"]').first()).toBeVisible();
  });
}

test("guest booking, security check refused: nothing is mailed, no code step", async ({ page }) => {
  const email = `e2e-guest-refused-${Date.now()}@akinaza.test`;
  await reachGuestStep(page, FAIL_BASE, "en");
  await fillDetails(page, "en", email);
  await captchaSolved(page);
  const answer = page.waitForResponse((r) => r.url().includes("/guest/code") && r.request().method() === "POST");
  await page.getByRole("button", { name: W.en.send }).click();
  expect((await answer).status()).toBe(400);
  await expect(page.getByLabel(W.en.code, { exact: true })).toHaveCount(0);
  expect(mails.filter((m) => m.to === email)).toHaveLength(0);
});

#!/usr/bin/env node
// End-to-end walk of the new pricing as two personas, against a RUNNING app wired to the payment processor's TEST mode
// (a test key; the free trial is refused on a live one) with its webhook forwarded to /api/webhooks/payments:
//   - Mathilde, a dog walker, starts the free months of Starter with the processor's test card and sees the date of the first charge;
//   - « Les Amis du parc », an association, is refused the Association plan, sends its NEQ, an administrator approves it,
//     and it then starts its free months.
//
//   E2E_BASE=http://localhost:3000 E2E_OWNER_EMAIL=… E2E_ASSO_EMAIL=… E2E_ADMIN_EMAIL=… (and their *_PASSWORD) \
//   E2E_SHOTS=<dir> node scripts/e2e-pricing.mjs        (needs a Chromium for playwright-core)
//
// Sessions are bearers kept in memory only; nothing sensitive is printed.
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";

import { CARD, signIn, startTrialCheckout } from "./lib/e2e-pricing.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const need = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};
const out = (line) => process.stdout.write(`${line}\n`);
let failed = 0;
const check = (ok, what) => {
  out(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failed += 1;
};
const shots = process.env.E2E_SHOTS;
if (shots) mkdirSync(shots, { recursive: true });

const api = async (bearer, path, init = {}) => {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json", ...init.headers } });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

const browser = await chromium.launch();
try {
  const owner = await signIn(BASE, need("E2E_OWNER_EMAIL"), need("E2E_OWNER_PASSWORD"));
  const asso = await signIn(BASE, need("E2E_ASSO_EMAIL"), need("E2E_ASSO_PASSWORD"));
  const admin = await signIn(BASE, need("E2E_ADMIN_EMAIL"), need("E2E_ADMIN_PASSWORD"));

  // Mathilde: Starter with its free months, paid on the processor's page with the test card.
  const session = await startTrialCheckout(api, owner, "starter");
  check(session.status === 200 && typeof session.body.url === "string", "Mathilde: the checkout for Starter opens (the free months are carried by the processor)");
  if (session.body.url) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(session.body.url);
    await page.getByLabel(/card number|numéro de carte/i).fill(CARD.number);
    await page.getByLabel(/expir/i).fill(CARD.expiry);
    await page.getByLabel(/cvc/i).fill(CARD.cvc);
    await page.getByLabel(/name on card|nom/i).fill("Mathilde");
    await page.getByRole("button", { name: /start trial|subscribe|commencer|abonner/i }).click();
    await page.waitForURL(/billing=success/, { timeout: 90_000 });
    check(true, "Mathilde: the test card is accepted and she lands back in her space");
    for (let i = 0; i < 20 && !/Free until|Offert jusqu/.test(await page.content()); i += 1) {
      await new Promise((r) => setTimeout(r, 1500));
      await page.goto(`${BASE}/en/app/profile/subscription`);
    }
    check(/Free until|Offert jusqu/.test(await page.content()), "Mathilde: her subscription page says it is a free period and when the first charge happens");
    if (shots) await page.screenshot({ path: `${shots}/mathilde-trial-phone.png`, fullPage: true });
  }

  // The association: refused first, then proof, decision, checkout.
  const early = await api(asso, "/api/billing/checkout?plan=association", { method: "POST" });
  check(early.status === 403 && early.body.code === "ASSOCIATION_NOT_APPROVED", "Les Amis du parc: the Association plan is refused before approval (they stay on Starter)");
  const sent = await api(asso, "/api/billing/association", { method: "POST", body: JSON.stringify({ kind: "neq", reference: "1234567890" }) });
  check(sent.status === 201 && sent.body.status === "pending", "Les Amis du parc: the NEQ is sent and waits for review");
  const queue = await api(admin, "/api/admin/associations");
  const proof = queue.body.pending?.find((p) => p.reference === "1234567890");
  check(Boolean(proof), "The administrator sees the proof in the queue");
  const decided = await api(admin, `/api/admin/associations/${proof?.id}`, { method: "POST", body: JSON.stringify({ decision: "approved" }) });
  check(decided.status === 200, "The administrator approves it (audited)");
  const late = await startTrialCheckout(api, asso, "association");
  check(late.status === 200 && typeof late.body.url === "string", "Les Amis du parc: the Association checkout now opens, with its free months");
} finally {
  await browser.close();
}
if (failed) {
  out(`${failed} check(s) failed`);
  process.exit(1);
}
out("all checks passed");

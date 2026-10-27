#!/usr/bin/env node
// End-to-end walk of the administration console (admin.akinaza.com, served here as admin.localhost): sign in as the
// administrator from an allowed address, open every page, act on an account (role, sessions, export, erasure), and check
// that an address outside AUTH_ALLOWED_IPS is refused.
//
//   DATABASE_URL=postgres://… E2E_SHOTS=<dir> pnpm run e2e:admin        (a local PostgreSQL; needs a Chromium for playwright-core)
//
// It creates two throw-away accounts through scripts/qa-accounts.mjs and removes them at the end. Nothing is printed
// but the checks; the password is generated per run.
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";

import { accountsFromEnv, hashPassword } from "../apps/web/scripts/qa-accounts.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");
const pg = require("../apps/web/node_modules/pg");

const PORT = 3193;
const BASE = `http://admin.localhost:${PORT}`;
const ALLOWED = "203.0.113.7";
const OTHER = "198.51.100.9";
const stamp = Date.now();
const password = crypto.randomBytes(18).toString("base64url");
const admin = `e2e-admin-${stamp}@akinaza.test`;
const member = `e2e-member-${stamp}@akinaza.test`;
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL (a local PostgreSQL) is required");
accountsFromEnv({ QA_USER_EMAIL: member, QA_USER_PASSWORD: password, QA_ADMIN_EMAIL: admin, QA_ADMIN_PASSWORD: password });

const out = (line) => process.stdout.write(`${line}\n`);
let failed = 0;
const check = (ok, what) => {
  out(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failed += 1;
};

const app = spawn("pnpm", ["--filter", "@akinaza/web", "exec", "next", "dev", "-p", String(PORT)], {
  env: { ...process.env, AUTH_ALLOWED_IPS: ALLOWED, ABUSE_CLIENT_IP_HEADER: "do-connecting-ip", APP_SEARCH_INDEXING: "off" },
  stdio: "ignore",
});
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

try {
  for (let i = 0; i < 120; i += 1) {
    try {
      if ((await fetch(`${BASE}/robots.txt`)).ok) break;
    } catch {
      /* starting */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  // The app migrates on start; make sure, then provision the two accounts exactly like qa-accounts does.
  for (let i = 0; i < 30; i += 1) {
    const { rows } = await db.query("SELECT to_regclass('accounts') AS t");
    if (rows[0].t) break;
    await fetch(`${BASE}/en/sign-in`, { headers: { "do-connecting-ip": ALLOWED } }).catch(() => undefined);
    await new Promise((r) => setTimeout(r, 1000));
  }
  const hash = await hashPassword(password);
  const ids = {};
  for (const [email, role] of [[admin, "ADMIN"], [member, "USER"]]) {
    ids[role] = (await db.query("INSERT INTO accounts (email, role, password_hash) VALUES ($1, $2, $3) RETURNING id", [email, role, hash])).rows[0].id;
  }
  // A demo shop for the merchant, through the real pipeline (facts applied, rules sealed).
  const seeded = spawnSync("pnpm", ["--filter", "@akinaza/db", "seed", member], { env: process.env, stdio: "ignore" });
  if (seeded.status !== 0) throw new Error("the demo shop could not be seeded");

  const refused = await fetch(`${BASE}/en/sign-in`, { headers: { "do-connecting-ip": OTHER } });
  check(refused.status === 404 || refused.status === 403, `an address outside the list is refused (${refused.status})`);

  const attempt = await fetch(`${BASE}/api/auth/sign-in`, { method: "POST", headers: { "do-connecting-ip": OTHER, "content-type": "application/json" }, body: JSON.stringify({ email: admin, password }) });
  check(attempt.status === 403, `the sign-in call from a foreign address is refused even with the right password (${attempt.status})`);

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark", extraHTTPHeaders: { "do-connecting-ip": ALLOWED } });
  await context.addInitScript(() => {
    try {
      localStorage.setItem("kz-theme", "dark");
    } catch {
      /* none */
    }
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/en/sign-in`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500); // dev compile: let the form hydrate before it is submitted
  await page.getByLabel("E-mail").fill(admin);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(`${BASE}/en`, { timeout: 90_000 });
  check(true, "the administrator signs in from an allowed address");

  if (process.env.E2E_SHOTS) mkdirSync(process.env.E2E_SHOTS, { recursive: true });
  const pages = [["", "Health"], ["/users", null], [`/users/${ids.USER}`, member], ["/shops", "Salon Laurier"], ["/invoices", "Salon Laurier"], ["/ledger", "Salon Laurier"], ["/operations", "Database budget"], ["/incidents", "Confidentiality incidents"], ["/audit", null]];
  for (const [path, text] of pages) {
    await page.goto(`${BASE}/en${path}`, { waitUntil: "networkidle" });
    if (text) check(await page.getByText(text).first().isVisible(), `/en${path || ""} shows "${text}"`);
    else check((await page.locator("main").count()) > 0, `/en${path} renders`);
    if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/${path.startsWith("/users/") ? "user" : path.slice(1) || "overview"}.png` });
  }
  await page.goto(`${BASE}/en/operations`, { waitUntil: "networkidle" });
  check(await page.getByText("Tax ledger").first().isVisible(), "/operations shows the tax ledger checks");

  await page.goto(`${BASE}/en/users/${ids.USER}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Make administrator" }).click();
  await page.getByRole("button", { name: "Withdraw administrator role" }).waitFor({ timeout: 15_000 });
  check(true, "the role is granted from the account page");
  await page.getByRole("button", { name: "Withdraw administrator role" }).click();
  await page.getByRole("button", { name: "Make administrator" }).waitFor({ timeout: 15_000 });
  const exported = await context.request.get(`${BASE}/api/admin/users/${ids.USER}/export`);
  const body = await exported.json();
  check(exported.ok() && body.shops?.length === 1 && !JSON.stringify(body).includes("password"), "the Law 25 export carries the shops and no password");
  await page.getByLabel("Type the account's e-mail to confirm").fill(member);
  await page.getByRole("button", { name: "Delete the account" }).click();
  await page.getByText("invoices are kept for six years").first().waitFor({ timeout: 15_000 });
  check((await db.query("SELECT 1 FROM accounts WHERE id = $1", [ids.USER])).rowCount === 1, "an account that owns a shop is not erased: its invoices are kept six years");
  const plain = (await db.query("INSERT INTO accounts (email, role, password_hash) VALUES ($1, 'USER', $2) RETURNING id", [`e2e-plain-${stamp}@akinaza.test`, hash])).rows[0].id;
  await page.goto(`${BASE}/en/users/${plain}`, { waitUntil: "networkidle" });
  await page.getByLabel("Type the account's e-mail to confirm").fill(`e2e-plain-${stamp}@akinaza.test`);
  await page.getByRole("button", { name: "Delete the account" }).click();
  await page.waitForURL(`${BASE}/en/users`, { timeout: 15_000 });
  check((await db.query("SELECT 1 FROM accounts WHERE id = $1", [plain])).rowCount === 0, "an account without a shop is erased");
  await browser.close();
} finally {
  await db.query("DELETE FROM accounts WHERE email = ANY($1)", [[admin, member]]).catch(() => undefined);
  await db.end();
  app.kill("SIGTERM");
}
process.exit(failed ? 1 : 0);

#!/usr/bin/env node
// Captures of the storefront work (#261) in a real browser, on a seeded, throw-away database: a PostgreSQL 16 container, `next dev`, the Saint-Henri persona
// (scripts/seed-saint-henri.mjs) and the demo shops (seed:demos), the templates switched on, then every scene in dark and light, desktop and phone.
//
//   SHOTS_OUT=<dir> [SHOTS_SCENES=look,new,storefront] [SHOTS_DEVICES=desktop,phone] [SHOTS_LOCALE=fr] [SHOTS_PORT=3214] [SHOTS_DB_PORT=5436] pnpm run shots:storefront
//
// Needs Docker and a Chromium for playwright-core. Every password is generated for the run and never printed; the container and the app are removed at
// the end, whatever happened. The captures go to Bunny pr-assets (krizaka-com's scripts/pr-assets.mjs), never into the repository.
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** The views captured: where they are (the shop's id and slug fill the address) and what must be visible before the shot. */
export const SCENES = {
  look: { path: (locale, shop) => `/${locale}/app/${shop.id}/shop?tab=look`, expect: { fr: "Modèle de page", en: "Page template" }, signedIn: true },
  new: { path: (locale, shop) => `/${locale}/app/${shop.id}/shop/new`, expect: { fr: "Votre métier", en: "Your trade" }, signedIn: true },
  // The public pages wait for the shop's name (its heading, there on every device); a button's words move with the layout.
  storefront: { path: (locale, shop) => `/${locale}/s/${shop.slug}`, expect: { fr: "Pattes de Saint-Henri", en: "Pattes de Saint-Henri" }, signedIn: false },
  // The home's neighbourhood feed (akinaza#318): the flyers the demo shops pinned, shot as the section alone.
  home: { path: (locale) => `/${locale}`, expect: { fr: "Affiché dans votre quartier", en: "Posted in your neighbourhood" }, signedIn: false, element: "section:has([data-testid=neighbourhood-feed])" },
  // The demo shops (packages/db/src/demo-shops.ts), each on a template of its trade (#261, step 6).
  salon: { path: (locale) => `/${locale}/s/cedre-ciseaux`, expect: { fr: "Salon Cèdre & Ciseaux", en: "Salon Cèdre & Ciseaux" }, signedIn: false },
  workshop: { path: (locale) => `/${locale}/s/encre-vive`, expect: { fr: "Encre Vive Studio", en: "Encre Vive Studio" }, signedIn: false },
  consulting: { path: (locale) => `/${locale}/s/ferland-conseil`, expect: { fr: "Ferland Conseil", en: "Ferland Conseil" }, signedIn: false },
  // The owner's guide (akinaza#382, `pnpm run shots:docs`): its figures are captured from the demo shop, never drawn.
  "docs-shop": { path: (locale, shop) => `/${locale}/app/${shop.id}/settings/page`, expect: { fr: "Votre page boutique", en: "Your shop page" }, signedIn: true },
  "docs-bookings": { path: (locale, shop) => `/${locale}/s/${shop.slug}`, expect: { fr: "Pattes de Saint-Henri", en: "Pattes de Saint-Henri" }, signedIn: false },
  "docs-invoices": { path: (locale, shop) => `/${locale}/app/${shop.id}/invoices/new`, expect: { fr: "Nouvelle facture", en: "New invoice" }, signedIn: true },
  "docs-books": { path: (locale, shop) => `/${locale}/app/${shop.id}/books`, expect: { fr: "Vos livres", en: "Your books" }, signedIn: true },
  // The owner's figures (#260): what to do now on Today, the figures with their formulas on the books, and the thresholds the owner tunes.
  "figures-today": { path: (locale, shop) => `/${locale}/app/${shop.id}/today`, expect: { fr: "Que faire maintenant", en: "What to do now" }, signedIn: true },
  "figures-books": { path: (locale, shop) => `/${locale}/app/${shop.id}/books`, expect: { fr: "Vos chiffres", en: "Your figures" }, signedIn: true },
  "figures-thresholds": { path: (locale, shop) => `/${locale}/app/${shop.id}/settings/figures`, expect: { fr: "Quand un chiffre demande votre attention", en: "When a figure needs your attention" }, signedIn: true },
  // The private calendar links (#282, ADR-004).
  "agenda-sources": { path: (locale, shop) => `/${locale}/app/${shop.id}/settings/agenda`, expect: { fr: "Vos autres agendas", en: "Your other calendars" }, signedIn: true },
  "agenda-feed": { path: (locale, shop) => `/${locale}/app/${shop.id}/settings/agenda`, expect: { fr: "Votre agenda sur votre téléphone", en: "Your calendar on your phone" }, signedIn: true },
  "docs-data": { path: (locale) => `/${locale}/app/profile/data`, expect: { fr: "Vos données", en: "Your data" }, signedIn: true },
};
/** The scenes of the owner's guide, one per page of it (`docs.pages.<id>`). */
export const DOCS_SCENES = Object.keys(SCENES).filter((s) => s.startsWith("docs-"));
export const THEMES = ["dark", "light"];
export const DEVICES = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };

/** The extra features switched on for the run only (`SHOTS_FLAGS=features.cahierStorefront,…`): the throw-away database, never a shared one. */
export const flagsOf = (value) => (value ?? "").split(",").map((s) => s.trim()).filter((s) => /^features\.[A-Za-z]+$/.test(s));

/** The slugs of the demo shops (packages/db/src/demo-shops.ts): the owners a person's flag is set for (`SHOTS_DEMO_FLAGS`), never anyone else. */
export const DEMO_SLUGS = ["cedre-ciseaux", "encre-vive", "ferland-conseil"];

/** `look-phone-dark.png`: one file per scene, device and theme. */
export const shotName = (scene, device, theme) => `${scene}-${device}-${theme}.png`;

/** Every capture of a run, in a stable order (scenes, then devices, then themes). */
export function plan(scenes = Object.keys(SCENES), devices = Object.keys(DEVICES)) {
  const unknown = [...scenes.filter((s) => !SCENES[s]), ...devices.filter((d) => !DEVICES[d])];
  if (unknown.length) throw new Error(`unknown scene(s) or device(s): ${unknown.join(", ")} (known: ${Object.keys(SCENES).join(", ")}; ${Object.keys(DEVICES).join(", ")})`);
  return scenes.flatMap((scene) => devices.flatMap((device) => THEMES.map((theme) => ({ scene, device, theme, file: shotName(scene, device, theme) }))));
}

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const need = (name) => {
  if (!process.env[name]) throw new Error(`${name} is required`);
  return process.env[name];
};

/** A pg Client that failed to connect cannot try again: a fresh one per attempt, until the container answers. */
async function connectWhenUp(pg, connectionString) {
  const attempts = 60;
  for (let i = 0; i <= attempts; i += 1) {
    const attempt = new pg.Client({ connectionString });
    try {
      await attempt.connect();
      return attempt;
    } catch (error) {
      if (i === attempts) throw error;
      await sleep(1000);
    }
  }
  throw new Error("unreachable");
}

/** Waits for the dev server, then asks for a page until the app has migrated the schema (it migrates on start). */
async function waitForApp(db, base, locale) {
  for (let i = 0; i < 180; i += 1) {
    try {
      if ((await fetch(`${base}/robots.txt`)).ok) break;
    } catch {
      /* starting */
    }
    await sleep(1000);
  }
  for (let i = 0; i < 60; i += 1) {
    const { rows } = await db.query("SELECT to_regclass('shop_page') AS t");
    if (rows[0].t) break;
    await fetch(`${base}/${locale}/sign-in`).catch(() => undefined);
    await sleep(1000);
  }
}

/** Signs the owner in once; every other context starts from that session. */
async function signInOnce(browser, { base, locale, owner }) {
  const first = await browser.newContext({ viewport: DEVICES.desktop, locale: locale === "fr" ? "fr-CA" : "en-CA" });
  const page = await first.newPage();
  await page.goto(`${base}/${locale}/sign-in`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.getByLabel(locale === "fr" ? "Courriel" : "E-mail").fill(owner.email);
  await page.getByLabel(locale === "fr" ? "Mot de passe" : "Password").fill(owner.password);
  await page.getByRole("button", { name: locale === "fr" ? "Se connecter" : "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/sign-in"), { timeout: 120_000 });
  const storageState = await first.storageState();
  await first.close();
  return storageState;
}

/** One scene: open it, wait for its text, walk the page once so that anything that waits to be seen has been, then shoot. */
async function shoot(p, { base, locale, shop, shot, outDir }) {
  const scene = SCENES[shot.scene];
  await p.goto(`${base}${scene.path(locale, shop)}`, { waitUntil: "networkidle", timeout: 120_000 });
  await p.getByText(scene.expect[locale]).first().waitFor({ timeout: 60_000 });
  await p.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await p.waitForTimeout(800); // fonts and the reveal
  const file = path.join(outDir, shot.file);
  await (scene.element ? p.locator(scene.element).screenshot({ path: file }) : p.screenshot({ path: file, fullPage: true }));
}

/** Every planned capture of one device in one theme, in one context. */
async function captureTheme(browser, { device, viewport, theme, scenes, storageState, ctx, out }) {
  // Reduced motion: what the page reveals on scroll is there at once, as for a person who asked for it; the shot shows the whole page.
  const context = await browser.newContext({ viewport, colorScheme: theme, reducedMotion: "reduce", storageState, locale: ctx.locale === "fr" ? "fr-CA" : "en-CA", deviceScaleFactor: device === "phone" ? 2 : 1 });
  await context.addInitScript((t) => {
    try {
      localStorage.setItem("kz-theme", t);
    } catch {
      /* none */
    }
  }, theme);
  const p = await context.newPage();
  const taken = [];
  for (const shot of scenes.filter((s) => s.device === device && s.theme === theme)) {
    await shoot(p, { ...ctx, shot });
    taken.push(shot);
    out(`shots: ${shot.file}`);
  }
  await context.close();
  return taken;
}

async function main() {
  const require = createRequire(import.meta.url);
  const { chromium } = require("playwright-core");
  const pg = require(path.join(root, "apps/web/node_modules/pg"));
  const OUT = need("SHOTS_OUT");
  const LOCALE = process.env.SHOTS_LOCALE === "en" ? "en" : "fr";
  const PORT = Number(process.env.SHOTS_PORT ?? 3214);
  const DB_PORT = Number(process.env.SHOTS_DB_PORT ?? 5436);
  const list = (name) => (process.env[name] ? process.env[name].split(",").map((s) => s.trim()).filter(Boolean) : undefined);
  const scenes = plan(list("SHOTS_SCENES"), list("SHOTS_DEVICES"));
  const BASE = `http://localhost:${PORT}`;
  const container = `akinaza-shots-${process.pid}`;
  const dbPassword = crypto.randomBytes(18).toString("base64url");
  const DATABASE_URL = `postgresql://akinaza:${dbPassword}@localhost:${DB_PORT}/akinaza_shots`;
  const env = {
    ...process.env,
    DATABASE_URL,
    DATABASE_DIRECT_URL: "", // migrations prefer the direct URL when set: empty, they run on the container
    APP_PUBLIC_URL: BASE,
    AUTH_SESSION_SECRET: crypto.randomBytes(36).toString("base64url"),
    APP_DATA_ENCRYPTION_KEY: crypto.randomBytes(32).toString("base64"),
    AUTH_SIGNUP_ENABLED: "false",
    APP_SEARCH_INDEXING: "off",
    MAIL_PROVIDER: "none",
    NEXT_PUBLIC_APP_HOST: `localhost:${PORT}`,
  };
  const walkerPassword = crypto.randomBytes(18).toString("base64url");
  const clientsPassword = crypto.randomBytes(18).toString("base64url");
  mkdirSync(OUT, { recursive: true });

  const started = spawnSync("docker", ["run", "-d", "--rm", "--name", container, "-e", "POSTGRES_USER=akinaza", `-e`, `POSTGRES_PASSWORD=${dbPassword}`, "-e", "POSTGRES_DB=akinaza_shots", "-p", `${DB_PORT}:5432`, "postgres:16"], { encoding: "utf8" });
  if (started.status !== 0) throw new Error(`docker run failed: ${started.stderr}`);
  let app = null;
  const out = (line) => process.stdout.write(`${line}\n`);
  try {
    const db = await connectWhenUp(pg, DATABASE_URL);
    out("shots: database up");

    app = spawn("pnpm", ["--filter", "@akinaza/web", "exec", "next", "dev", "-p", String(PORT)], { cwd: root, env, stdio: "ignore" });
    await waitForApp(db, BASE, LOCALE);
    out("shots: app up, schema there");

    const run = (args, extra = {}) => {
      const r = spawnSync("pnpm", args, { cwd: root, env: { ...env, ...extra }, encoding: "utf8" });
      if (r.status !== 0) throw new Error(`${args.join(" ")} failed:\n${r.stdout}\n${r.stderr}`);
    };
    run(["--filter", "@akinaza/web", "exec", "tsx", "scripts/seed-saint-henri.mjs"], { QA_WALKER_PASSWORD: walkerPassword, QA_CLIENTS_PASSWORD: clientsPassword });
    run(["--filter", "@akinaza/db", "seed:demos"]);
    run(["--filter", "@akinaza/web", "exec", "tsx", "scripts/set-setting.mjs", "features.storefrontTemplates", "true", "--actor", "shots-storefront"]);
    for (const flag of flagsOf(process.env.SHOTS_FLAGS)) run(["--filter", "@akinaza/web", "exec", "tsx", "scripts/set-setting.mjs", flag, "true", "--actor", "shots-storefront"]);
    // The demo shops' owners only (a person's value of the administration, as in production): `SHOTS_DEMO_FLAGS=features.cahierStorefront`.
    const demoOwners = (await db.query("SELECT a.email FROM shops s JOIN accounts a ON a.id = s.owner_id WHERE s.slug = ANY($1)", [DEMO_SLUGS])).rows;
    for (const flag of flagsOf(process.env.SHOTS_DEMO_FLAGS)) for (const { email } of demoOwners) run(["--filter", "@akinaza/web", "exec", "tsx", "scripts/set-setting.mjs", flag, "true", "--user", email, "--actor", "shots-storefront"]);
    const { rows } = await db.query("SELECT s.id, s.slug, a.email FROM shops s JOIN accounts a ON a.id = s.owner_id WHERE s.slug = 'pattes-saint-henri'");
    if (!rows[0]) throw new Error("the Saint-Henri shop was not seeded");
    const shop = { id: rows[0].id, slug: rows[0].slug };
    const owner = { email: rows[0].email, password: walkerPassword };
    await db.end();
    out(`shots: seeded ${shop.slug}`);

    const browser = await chromium.launch();
    const storageState = await signInOnce(browser, { base: BASE, locale: LOCALE, owner });
    out("shots: signed in");

    const taken = [];
    const ctx = { base: BASE, locale: LOCALE, shop, outDir: OUT };
    for (const [device, viewport] of Object.entries(DEVICES)) {
      if (!scenes.some((s) => s.device === device)) continue;
      for (const theme of THEMES) taken.push(...(await captureTheme(browser, { device, viewport, theme, scenes, storageState, ctx, out })));
    }
    await browser.close();
    writeFileSync(path.join(OUT, "scenes.json"), `${JSON.stringify({ locale: LOCALE, shop: shop.slug, shots: taken }, null, 2)}\n`);
    out(`shots: ${taken.length} capture(s) in ${OUT}`);
  } finally {
    if (app) app.kill("SIGTERM");
    spawnSync("docker", ["rm", "-f", container], { stdio: "ignore" });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`shots: ${error.message}`);
    process.exit(1);
  });
}

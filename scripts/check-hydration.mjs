#!/usr/bin/env node
// One rendering for the server and the browser (docs/ux/2026-10-full-review.md, A6 / K0): every page a visitor, a client
// and an owner open is hydrated in a browser whose time zone and language are a visitor's (Montréal, fr-CA) while the
// server runs in UTC as in production — the only way a text that differs between the two shows. Exits 1 listing every page
// × theme × width where React reported a hydration error, the console an error, or the page an uncaught exception.
//
//   HYDRATION_OWNER_EMAIL=… HYDRATION_OWNER_PASSWORD=… [HYDRATION_CLIENT_EMAIL=… HYDRATION_CLIENT_PASSWORD=…] \
//     node scripts/check-hydration.mjs --base http://localhost:3000 [--locale en-US] [--timezone America/Vancouver]
//
// Without credentials only the public pages are crawled. Passwords stay in the environment; nothing but the checks is printed.
import { chromium } from "playwright-core";

/** A visitor's browser: Montréal's clock and the product's first language — never the server's UTC. */
export const BROWSER = { timezoneId: "America/Toronto", locale: "fr-CA" };
export const THEMES = ["dark", "light"];
/** After `load`, the time React takes to hydrate the streamed parts of a page (a hydration error is reported at once). A video that keeps streaming would never reach `networkidle`. */
const SETTLE_MS = 800;
/** A desktop and a phone: the frame draws different parts (the drawer, the sticky action) at each. */
export const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 360, height: 780 },
];

/** Signed out: the home, the legal page, the auth pages, the three demo storefronts and the walker's, a service, the two 404s. */
export const PUBLIC_PAGES = [
  "/fr",
  "/en",
  "/fr/privacy",
  "/en/privacy",
  "/fr/sign-in",
  "/fr/sign-up",
  "/fr/forgot-password",
  "/fr/s/cedre-ciseaux",
  "/fr/s/encre-vive",
  "/fr/s/ferland-conseil",
  "/fr/s/pattes-saint-henri",
  "/en/s/pattes-saint-henri",
  "/fr/s/nope",
  "/fr/nope",
];

/** The owner's space, relative to `/app/<shop>` (`/app` itself leads to the shop's day and says which shop). */
export const OWNER_PAGES = ["/aujourdhui", "/clients", "/invoices", "/invoices/new", "/books", "/team", "/shop", "/shop/languages"];
/** The account's own pages. */
export const ACCOUNT_PAGES = ["/app/profile", "/app/profile/security"];

/** The first record a list links (`<list>/<id>`), never its creation page (`<list>/new`) nor another list: the detail page to crawl. */
export const firstRecord = (hrefs, listPath) => hrefs.find((href) => typeof href === "string" && href.startsWith(`${listPath}/`) && !/\/new(\?.*)?$/.test(href) && !href.slice(listPath.length + 1).includes("/")) ?? null;

/** The pages a list's first record opens: the record, and for an invoice its correction screen (« Modifier », #207). */
export const detailPagesFor = (list, href) => (list.endsWith("/invoices") ? [href, `${href}/correct`] : [href]);

/**
 * One primary per screen (D1b, errata 2 of docs/ux/2026-10-full-review.md): never two `[data-primary]` on a page, and exactly one on
 * the owner's day, lists and invoice screens — the header's « Nouvelle facture » or the page's own (the next appointment, « Envoyer
 * la facture », the form's submit). A Boutique section holds its save; a page with nothing to do may have none.
 */
const ONE_PRIMARY = /\/app\/[^/]+\/(aujourdhui|clients|invoices|books)(\/[^/?]+(\/correct)?)?(\?.*)?$/;
export const primaryProblem = (path, count) => {
  if (count > 1) return `${count} primary actions (one at most)`;
  if (count !== 1 && ONE_PRIMARY.test(path)) return `${count} primary actions (one expected)`;
  return null;
};

/** What every page owes besides one rendering: exactly one `h1` (the page's, never the frame's), one primary in view at most (a form may draw its submit once per width: the aside, the sticky action), no horizontal overflow. */
const audit = (page) => page.evaluate(() => ({ h1: document.querySelectorAll("h1").length, primary: [...document.querySelectorAll("[data-primary]")].filter((e) => e.checkVisibility()).length, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth }));
const judge = (report, { h1, primary, overflow }, path) => {
  if (h1 !== 1) report("h1", `${h1} on the page (one expected)`);
  const tooMany = primaryProblem(path, primary);
  if (tooMany) report("primary", tooMany);
  if (overflow) report("overflow", "the page scrolls sideways");
};

/** What React says when the server and the browser disagree (the minified codes in production, the sentences in development). */
export const isHydrationError = (text) => /Minified React error #(418|419|420|421|422|423|424|425)\b|Hydration failed|hydrated but some attributes|did not match|Text content does not match|There was an error while hydrating/i.test(text);

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};

/** Signs the context in through the product's own route; the cookie lands in the context's jar. */
async function signIn(context, base, email, password) {
  const answer = await context.request.post(`${base}/api/auth/sign-in`, { data: { email, password } });
  if (!answer.ok()) throw new Error(`sign-in as ${email} answered ${answer.status()}`);
}

/** Visits every path, in both themes and at both widths, and records what the browser reported. */
async function crawl(browser, { base, paths, theme, account, problems, visited, visitor }) {
  const context = await browser.newContext({ ...visitor, colorScheme: theme });
  await context.addInitScript((t) => {
    try {
      localStorage.setItem("kz-theme", t);
    } catch {}
  }, theme);
  if (account) await signIn(context, base, account.email, account.password);
  const page = await context.newPage();
  let current = "";
  const seen = new Set();
  let expected404 = false;
  const report = (kind, text) => {
    // A page meant to be a 404 answers 404 (and its home link's prefetch is redirected): the browser logs that, not a defect.
    if (expected404 && /^Failed to load resource/.test(text)) return;
    const key = `${current} ${kind} ${text.slice(0, 80)}`;
    if (seen.has(key)) return;
    seen.add(key);
    problems.push(`${current}: ${kind}: ${text.replace(/\s+/g, " ").slice(0, 400)}`);
  };
  page.on("console", (m) => m.type() === "error" && report(isHydrationError(m.text()) ? "hydration" : "console error", m.text()));
  page.on("pageerror", (e) => report(isHydrationError(String(e.message)) ? "hydration" : "uncaught", String(e.message)));
  const links = {};
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    for (const path of paths) {
      current = `${account ? `${account.role} ` : ""}${path} @${viewport.width} ${theme}`;
      expected404 = path.endsWith("/nope");
      const response = await page.goto(`${base}${path}`, { waitUntil: "load" });
      await page.waitForTimeout(SETTLE_MS);
      judge(report, await audit(page), new URL(page.url()).pathname);
      const status = response?.status() ?? 0;
      const final = new URL(page.url()).pathname;
      visited.push({ path, final, status });
      // The two 404 checks must answer 404 and hydrate like any page; everything else must answer.
      if (expected404 ? status !== 404 : status >= 400) report("HTTP", String(status));
      // The first record of a list, so the detail pages are crawled too (a client's file, an invoice).
      if (account && /\/(clients|invoices)$/.test(path)) {
        const hrefs = await page.locator("main a[href]").evaluateAll((anchors) => anchors.map((a) => a.getAttribute("href")));
        const href = firstRecord(hrefs, path);
        if (href) links[path] = href;
      }
    }
    // The detail pages found on this pass.
    for (const [list, record] of Object.entries(links)) {
      for (const href of detailPagesFor(list, record)) {
        current = `${account?.role ?? ""} ${href.replace(/^.*\/app\/[^/]+/, "")} (from ${list}) @${viewport.width} ${theme}`;
        expected404 = false;
        await page.goto(`${base}${href}`, { waitUntil: "load" });
        await page.waitForTimeout(SETTLE_MS);
        judge(report, await audit(page), new URL(page.url()).pathname);
        visited.push({ path: href, final: new URL(page.url()).pathname, status: 200, from: list });
      }
    }
  }
  await context.close();
}

export async function check({ base, owner, client, visitor = BROWSER }) {
  const browser = await chromium.launch();
  const problems = [];
  const visited = [];
  try {
    for (const theme of THEMES) {
      await crawl(browser, { base, paths: PUBLIC_PAGES, theme, problems, visited, visitor });
      if (owner) {
        const context = await browser.newContext(visitor);
        await signIn(context, base, owner.email, owner.password);
        const page = await context.newPage();
        await page.goto(`${base}/fr/app`, { waitUntil: "load" });
        const root = new URL(page.url()).pathname.replace(/\/aujourdhui.*$/, "");
        await context.close();
        if (!/\/fr\/app\/[^/]+$/.test(root)) throw new Error(`the owner's /app did not lead to a shop's day (${root})`);
        const paths = [...OWNER_PAGES.map((p) => `${root}${p}`), root.replace("/fr/", "/en/") + "/aujourdhui", ...ACCOUNT_PAGES.map((p) => `/fr${p}`)];
        await crawl(browser, { base, paths, theme, account: { ...owner, role: "owner" }, problems, visited, visitor });
      }
      if (client) await crawl(browser, { base, paths: ["/fr/app", "/fr/app/profile", "/fr/s/pattes-saint-henri"], theme, account: { ...client, role: "client" }, problems, visited, visitor });
    }
  } finally {
    await browser.close();
  }
  return { problems, visited };
}

const account = (prefix) => (process.env[`${prefix}_EMAIL`] && process.env[`${prefix}_PASSWORD`] ? { email: process.env[`${prefix}_EMAIL`], password: process.env[`${prefix}_PASSWORD`] } : undefined);

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^.*\//, "/"))) {
  const base = arg("base", "http://localhost:3000").replace(/\/$/, "");
  const owner = account("HYDRATION_OWNER");
  const client = account("HYDRATION_CLIENT");
  if (!owner) process.stdout.write("check-hydration: no HYDRATION_OWNER_* credentials — the signed-in pages are not crawled\n");
  const visitor = { timezoneId: arg("timezone", BROWSER.timezoneId), locale: arg("locale", BROWSER.locale) };
  const { problems, visited } = await check({ base, owner, client, visitor });
  process.stdout.write(`check-hydration: ${visited.length} page loads in ${visitor.timezoneId} (${visitor.locale}), ${THEMES.length} themes, ${VIEWPORTS.length} widths\n`);
  const details = [...new Set(visited.filter((v) => v.from).map((v) => v.path.replace(/^.*\/app\/[^/]+/, "")))];
  if (details.length) process.stdout.write(`check-hydration: detail pages found ${details.join(", ")}\n`);
  if (problems.length) {
    process.stdout.write(`${problems.length} problem(s):\n${problems.map((p) => `  ${p}`).join("\n")}\n`);
    process.exit(1);
  }
  process.stdout.write("ok: the server and the browser rendered the same pages\n");
}

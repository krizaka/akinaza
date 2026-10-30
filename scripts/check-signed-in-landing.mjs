#!/usr/bin/env node
// A signed-in person never sees the public side first (krizaka-ui#827), proven in a real browser as the seeded persona:
//   1. `/` and `/<locale>` land on the home (`/<locale>/app`), server-side, with no page of the landing in between;
//   2. a public page that stays reachable signed in (pricing) never SHOWS « Sign in » in the bar — not at the first paint,
//      not for an instant while `/api/me` answers. The static HTML may hold the link, but under `html[data-session]` (set
//      before paint from the kz-session hint) it carries `data-signed-out-only` and is computed `display: none`; an observer
//      from document start records any breach;
//   3. the same public page signed out still offers « Sign in » (the guard is not vacuous).
//
//   E2E_EMAIL=… E2E_PASSWORD=… node scripts/check-signed-in-landing.mjs --base http://localhost:3000 [--locale fr]
import { chromium } from "playwright-core";

import { auditContext, loadSettled } from "@krizaka/page-audit";

/** Signs the context in through the API (as check-hydration does): the cookie lands in the context, no form in the way. */
async function signIn(page, base, _locale, email, password) {
  const answer = await page.context().request.post(`${base}/api/auth/sign-in`, { data: { email, password } });
  if (!answer.ok()) throw new Error(`sign-in as ${email} answered ${answer.status()}`);
}

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};

/** The one selector of a sign-in link in the bar. */
export const SIGN_IN_LINK = '[data-site-bar] a[href$="/sign-in"]';

/**
 * Records, from the first moment of the document, every « Sign in » link of the bar and what a hinted visitor would see of it
 * (CTO decision, krizaka-ui#827, Option 1). Under `html[data-session]` (set by the head script from the `kz-session` hint)
 * every such link must carry `data-signed-out-only` AND be computed `display: none` from the first paint on: the DOM may hold
 * the link, the eye never sees it. The computed style is read at the first paint (stylesheets block it, so the rule is
 * there) and again at every later mutation. Problems land in `window.__signInProblems`.
 */
export const watchSignInLink = () => {
  window.__signInProblems = [];
  window.__sawSignIn = false;
  let painted = false;
  const flag = (why) => {
    if (!window.__signInProblems.includes(why)) window.__signInProblems.push(why);
  };
  const inspect = () => {
    const links = document.querySelectorAll('[data-site-bar] a[href$="/sign-in"]');
    if (links.length) window.__sawSignIn = true;
    const hinted = document.documentElement.hasAttribute("data-session");
    for (const link of links) {
      if (!hinted) flag("a sign-in link is in the bar and html has no data-session (the head script did not run, or the hint cookie is missing)");
      else if (!link.hasAttribute("data-signed-out-only")) flag("a sign-in link of the bar lacks data-signed-out-only");
      else if (painted && getComputedStyle(link).display !== "none") flag("a sign-in link of the bar is visible under html[data-session] (computed display is not none)");
    }
  };
  new MutationObserver(inspect).observe(document, { childList: true, subtree: true, attributes: true });
  document.addEventListener("DOMContentLoaded", inspect);
  new PerformanceObserver((list, observer) => {
    if (!list.getEntries().some((entry) => entry.name === "first-paint")) return;
    painted = true;
    inspect();
    observer.disconnect();
  }).observe({ type: "paint", buffered: true });
};

/** The path of a URL, for a message. Pure, tested. */
export const pathOf = (url) => new URL(url).pathname;

/** The home of the app is `/<locale>/app`, which a person with a single shop is sent on from, to that shop's Today (`/<locale>/app/<shop>/…`): both are inside the app. */
export const inApp = (path, locale) => path === `/${locale}/app` || path.startsWith(`/${locale}/app/`);

export async function check({ base, locale = "fr", email, password }) {
  if (!email || !password) throw new Error("E2E_EMAIL and E2E_PASSWORD are required (the seeded owner)");
  const browser = await chromium.launch();
  const problems = [];
  try {
    const context = await auditContext(browser, { viewport: { width: 1280, height: 800 } });
    await context.addInitScript(watchSignInLink);
    const page = await context.newPage();
    // Signed out first: the public page does offer « Sign in » (so the next checks mean something).
    await loadSettled(page, `${base}/${locale}/pricing`);
    await page.waitForFunction(() => document.querySelector('[data-site-bar] a[href$="/sign-in"]') !== null, null, { timeout: 15_000 }).catch(() => {
      problems.push(`/${locale}/pricing signed out: no « Sign in » link in the bar (the guard would pass for nothing)`);
    });
    await signIn(page, base, locale, email, password);
    for (const from of ["/", `/${locale}`]) {
      await loadSettled(page, `${base}${from}`);
      if (!inApp(pathOf(page.url()), locale)) problems.push(`${from} signed in: landed on ${pathOf(page.url())}, expected the app (/${locale}/app…)`);
    }
    // The server answers the redirect itself: 307, private, varying with the cookie (no HTML of the landing page at all).
    const raw = await page.request.get(`${base}/${locale}`, { maxRedirects: 0 });
    if (raw.status() !== 307) problems.push(`/${locale} signed in: expected a 307 from the server, got ${raw.status()}`);
    if (raw.headers()["cache-control"] !== "private, no-store") problems.push(`/${locale} signed in: Cache-Control must be « private, no-store », got ${raw.headers()["cache-control"]}`);
    if (!/cookie/i.test(raw.headers().vary ?? "")) problems.push(`/${locale} signed in: Vary must name Cookie, got ${raw.headers().vary}`);
    await loadSettled(page, `${base}/${locale}/pricing`);
    await page.waitForFunction(() => document.querySelector('[data-site-bar] button, [data-site-bar] [data-state]') !== null, null, { timeout: 15_000 }).catch(() => {});
    const seen = await page.evaluate(() => ({ hinted: document.documentElement.hasAttribute("data-session"), problems: window.__signInProblems }));
    if (!seen.hinted) problems.push(`/${locale}/pricing signed in: html has no data-session (the head script must set it from the kz-session hint)`);
    for (const why of seen.problems) problems.push(`/${locale}/pricing signed in: ${why}`);
    await context.close();
  } finally {
    await browser.close();
  }
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const problems = await check({ base: arg("base", "http://localhost:3000"), locale: arg("locale", "fr"), email: process.env.E2E_EMAIL, password: process.env.E2E_PASSWORD });
  if (problems.length) {
    console.error(`${problems.length} problem(s):\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  console.log("signed in: / lands on the home, a public page never draws « Sign in »");
}

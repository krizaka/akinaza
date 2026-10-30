#!/usr/bin/env node
// Dev-preview crawl (ui.themes-devices): console errors, HTTP errors, empty pages, then the responsive guard: no horizontal overflow, and no tap target under 36 px in a primary action, at every width that matters,
// in both themes and both languages, on the pages a visitor lands on. The measures are the shared @krizaka/page-audit (krizaka-ui#747); this file holds only akinaza's pages and options.
//
//   node scripts/check-overflow.mjs --base http://localhost:3000 [--shots <dir>]
//
// Exits 1 listing every page x width x theme that overflows. With --shots it also writes a screenshot of each.
import { fileURLToPath } from "node:url";

import { auditRoutes } from "@krizaka/page-audit";

/** After `load`, the time fonts and images take to lay the page out. */
export const SETTLE_MS = 600;
export const WIDTHS = [360, 390, 430, 768, 1024, 1440];
export const THEMES = ["dark", "light"];
/** axe-core (WCAG 2.1 AA) runs at the phone and the desktop width only: a finding is counted once per route, theme and node (ratchet: a11y-baseline.json). */
export const A11Y_WIDTHS = [390, 1440];
export const A11Y_BASELINE = fileURLToPath(new URL("../a11y-baseline.json", import.meta.url));
/** The two demo shops and every composition they offer (akinaza#404): the Krizaka UI showcase must not overflow at any width. */
export const SHOP_PAGES = ["/en/s/cedre-ciseaux", "/fr/s/cedre-ciseaux?look=editorial", "/en/s/cedre-ciseaux?look=gallery", "/fr/s/pattes-saint-henri", "/en/s/pattes-saint-henri?look=journal"];
/** The signed-in frame (akinaza#396, the « never overflows » containment of the shared `AppFrame`), relative to `/<locale>/app/<shop>`: the owner's rail, header and account menu at every width. */
export const FRAME_PAGES = ["/today", "/clients", "/invoices", "/books", "/shop"];
export const FRAME_LOCALES = ["fr", "en"];
export const PAGES = ["/en", "/fr", "/en/explore", "/fr/explore", "/en/privacy", "/fr/privacy", "/en/changelog", "/fr/changelog", "/en/sign-in", "/fr/sign-in", ...SHOP_PAGES];

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};

/**
 * What akinaza asks of every page, in @krizaka/page-audit's words: the HTTP status, an empty <main>, the frame that forces a scroll (akinaza#444),
 * an action under 36 px, and every console error (a failed first-party request included: `ignoreConsole: []`). Horizontal overflow, elements past the
 * edge and the site bar over the development notice (akinaza#440, `[data-top-chrome]`) are measured by the audit itself.
 */
export const CHECKS = { status: true, emptyMain: true, frame: true, minAction: 36 };
export const OPTIONS = { widths: WIDTHS, themes: THEMES, themeKey: "kz-theme", height: 900, settleMs: SETTLE_MS, ignoreConsole: [], checks: CHECKS };
export const A11Y = { app: "akinaza", baseline: A11Y_BASELINE, widths: A11Y_WIDTHS };

/** The owner's session: sign in through the API, then the pages of the frame under the shop `/app` leads to, in both languages. */
export function ownerSession(owner) {
  return {
    async signIn(context, { base }) {
      const answer = await context.request.post(`${base}/api/auth/sign-in`, { data: { email: owner.email, password: owner.secret } });
      if (!answer.ok()) throw new Error(`sign-in as the owner answered ${answer.status()}`);
    },
    async routes(page, { base }) {
      await page.goto(`${base}/fr/app`, { waitUntil: "load" });
      const shopRoot = new URL(page.url()).pathname.replace(/^\/(fr|en)/, "").match(/^\/app\/[^/]+/)?.[0];
      if (!shopRoot) throw new Error(`the owner's /app did not lead to a shop (${page.url()})`);
      return FRAME_LOCALES.flatMap((l) => FRAME_PAGES.map((f) => `/${l}${shopRoot}${f}`));
    },
  };
}

/**
 * The seed states of an owner (akinaza#405): the cast's shops are busy, so each list is also crawled with NOTHING in it (an empty shop) and with ONE
 * item (one service, client, invoice, expense), as the owners `seed-owner-states` creates. Same frame pages, same measures; the axe ratchet counts
 * the public pages and the busy owner once, so these runs add the layout, console and tap-target checks only.
 */
export const STATE_OWNERS = [
  { state: "empty", emailVariable: "HYDRATION_EMPTY_OWNER_EMAIL" },
  { state: "one", emailVariable: "HYDRATION_ONE_OWNER_EMAIL" },
];

export async function check({ base, shots, owner, states = [] }) {
  const problems = await auditRoutes({ ...OPTIONS, base, routes: PAGES, shots, a11y: A11Y, session: owner ? ownerSession(owner) : undefined });
  for (const state of states) {
    const found = await auditRoutes({ ...OPTIONS, base, routes: [], shots: shots && `${shots}/${state.state}`, session: ownerSession(state) });
    problems.push(...found.map((line) => `[${state.state} shop] ${line}`));
  }
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { HYDRATION_OWNER_EMAIL: email, HYDRATION_OWNER_PASSWORD: secret } = process.env;
  if (!email || !secret) process.stdout.write("check-overflow: no HYDRATION_OWNER_* credentials, the signed-in frame is not checked\n");
  const password = process.env.HYDRATION_STATES_PASSWORD;
  const states = STATE_OWNERS.flatMap((s) => (process.env[s.emailVariable] && password ? [{ state: s.state, email: process.env[s.emailVariable], secret: password }] : []));
  if (states.length < STATE_OWNERS.length) process.stdout.write("check-overflow: no HYDRATION_STATES_PASSWORD or owner e-mails, the empty and one-item shops are not checked\n");
  const problems = await check({ base: arg("base", "http://localhost:3000"), shots: arg("shots"), owner: email && secret ? { email, secret } : undefined, states });
  if (problems.length) {
    console.error(`${problems.length} responsive problem(s):\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`no horizontal overflow: ${PAGES.length} public pages${email && secret ? ` and ${FRAME_PAGES.length * FRAME_LOCALES.length} pages of the signed-in frame` : ""} x ${WIDTHS.length} widths x ${THEMES.length} themes`);
}

#!/usr/bin/env node
// « Krizaka, Akinaza's first client » — four narrated walkthroughs on the real dev site, as the persona Éric (the owner of
// « Krizaka (démo) », a software studio in Montréal; never an administrator): onboarding (the business and its services),
// the invoice (hours and a flat fee, GST/QST to the cent), the books (what the ledger holds) and the prepared return (GST/QST
// lines, never filed). EN and FR, desktop and phone. Everything on screen is demo data: fictional clients, made-up tax numbers,
// plausible amounts — never Krizaka's real figures.
//
//   E2E_EMAIL=… E2E_PASSWORD=… node scripts/record-krizaka-first-client.mjs <out-dir> \
//     [--device phone|desktop] [--locale en|fr] [--clips onboarding,invoice,books,return] [--voice]
//
// The invoice clip issues one real invoice on the demo database (the persona's own books). Credentials stay in the
// environment and are never printed.
import { createRequire } from "node:module";
import path from "node:path";

import { createTake } from "./lib/take.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const args = process.argv.slice(2);
const flag = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const out = path.resolve(args[0] ?? "record-out");
const device = flag("device", "desktop");
const locale = flag("locale", "en") === "fr" ? "fr" : "en";
const wanted = flag("clips", "onboarding,invoice,books,return").split(",");
const voice = args.includes("--voice");
const BASE = (process.env.APP_BASE_URL ?? "https://dev.akinaza.com").replace(/\/$/, "");
const need = (n) => {
  if (!process.env[n]) throw new Error(`${n} is required`);
  return process.env[n];
};
const email = need("E2E_EMAIL");
const password = need("E2E_PASSWORD");
const VOICES = { en: "Samantha", fr: "Amélie" };
const VIEWPORT = device === "phone" ? { width: 390, height: 844 } : { width: 1280, height: 800 };

/** What is said at each beat (also the captions), per clip. */
export const WORDS = {
  onboarding: {
    open: {
      en: "Éric opens Akinaza for Krizaka, a software studio in Montréal. This is demo data: a fictional business with made-up tax numbers.",
      fr: "Éric ouvre Akinaza pour Krizaka, un studio de logiciel à Montréal. Ce sont des données de démonstration : une entreprise fictive, avec des numéros de taxes inventés.",
    },
    services: {
      en: "Its services are bookable and invoiceable items, by the hour or by the project: development, design, consulting, a scoping workshop and a monthly support plan.",
      fr: "Ses services sont des éléments réservables et facturables, à l'heure ou au projet : développement, design, conseil, un atelier de cadrage et un forfait de soutien mensuel.",
    },
    clients: {
      en: "Three business clients are on file, each with the consent that Loi 25 asks for. Akinaza only prepares taxes; it never files them.",
      fr: "Trois clients d'affaires sont au dossier, chacun avec le consentement que la Loi 25 exige. Akinaza prépare les taxes; elle ne les produit jamais.",
    },
  },
  invoice: {
    form: {
      en: "Éric issues an invoice from the services themselves: the client, the language, ten hours of one service and one flat-fee line.",
      fr: "Éric émet une facture à partir des services eux-mêmes : le client, la langue, dix heures d'un service et une ligne à forfait.",
    },
    issued: {
      en: "Issued. The invoice has its number, and the taxes were computed once, on the taxable total, to the cent.",
      fr: "Émise. La facture a son numéro, et les taxes ont été calculées une seule fois, sur le total taxable, au cent près.",
    },
    document: {
      en: "The document is in the client's language and carries the supplier's GST and QST numbers, which a business buyer needs to claim its credits.",
      fr: "Le document est dans la langue du client et porte les numéros de TPS et de TVQ du fournisseur, dont un acheteur d'affaires a besoin pour réclamer ses crédits.",
    },
  },
  books: {
    list: {
      en: "The books start here: every invoice of the studio, in French or in English, with its subtotal, GST, QST and total.",
      fr: "Les livres commencent ici : chaque facture du studio, en français ou en anglais, avec son sous-total, sa TPS, sa TVQ et son total.",
    },
    sources: {
      en: "Each figure of the return opens onto the documents behind it: the invoices that collected the taxes, the expenses that give credits. Every invoice posts to the ledger in the same step, and the database refuses an unbalanced one.",
      fr: "Chaque chiffre de la déclaration s'ouvre sur les documents qui le fondent : les factures qui ont perçu les taxes, les dépenses qui donnent des crédits. Chaque facture s'inscrit au grand livre dans la même étape, et la base refuse celle qui est déséquilibrée.",
    },
  },
  return: {
    top: {
      en: "The GST and QST return of the quarter is prepared from those books, line by line, for the form Revenu Québec uses.",
      fr: "La déclaration de TPS et de TVQ du trimestre est préparée à partir de ces livres, ligne par ligne, pour le formulaire de Revenu Québec.",
    },
    notFiled: {
      en: "It is prepared, never filed: Éric reviews it and files it himself. Nothing is sent from Akinaza.",
      fr: "Elle est préparée, jamais produite : Éric la vérifie et la produit lui-même. Rien n'est envoyé depuis Akinaza.",
    },
  },
};

const T = {
  en: { period: "2026-Q3", client: "Client", service: "Service", quantity: "Quantity", other: "Other line (description)", price: "Unit price", submit: "Issue the invoice", open: /^Open /, dev: /Software development/, consulting: /Consulting and architecture/, support: /Support and maintenance/, workshop: /Scoping workshop/, nord: /Nord Studio/, cafe: /Café du Parc/, books: /^Your books$/ },
  fr: { period: "2026-Q3", client: "Client", service: "Service", quantity: "Quantité", other: "Autre ligne (description)", price: "Prix unitaire", submit: "Émettre la facture", open: /^Ouvrir /, dev: /Développement logiciel/, consulting: /Conseil et architecture/, support: /Soutien et maintenance/, workshop: /Atelier de cadrage/, nord: /Nord Studio/, cafe: /Café du Parc/, books: /^Vos livres$/ },
}[locale];

/** Chooses the option of a native select whose text matches. */
async function choose(select, pattern) {
  const value = await select.evaluate((el, src) => [...el.options].find((o) => new RegExp(src).test(o.textContent ?? ""))?.value ?? null, pattern.source);
  if (value === null) throw new Error(`no option matches ${pattern}`);
  await select.selectOption(value);
}

/** One sign-in for the whole run (the API rate-limits sign-ins): every clip starts from the same session. */
const storageState = await (async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  let res = await context.request.post(`${BASE}/api/auth/sign-in`, { data: { email, password } });
  // The sign-in is rate-limited (429 + Retry-After): wait it out rather than hammer it.
  for (let tries = 0; res.status() === 429 && tries < 6; tries++) {
    await new Promise((r) => setTimeout(r, (Number(res.headers()["retry-after"]) || 60) * 1000 + 2000));
    res = await context.request.post(`${BASE}/api/auth/sign-in`, { data: { email, password } });
  }
  if (!res.ok()) throw new Error(`sign-in refused (${res.status()})`);
  const state = await context.storageState();
  await browser.close();
  return state;
})();

async function clip(id, run) {
  if (!wanted.includes(id)) return;
  const take = await createTake({ chromium, base: BASE, viewport: VIEWPORT, scale: device === "phone" ? 2 : 1, locale, outDir: path.join(out, device), name: `akinaza-${id}-${locale}`, mobile: device === "phone", storageState, words: WORDS[id], voices: VOICES });
  const { page } = take;
  const glide = (dy, ms = 1600) =>
    page.evaluate(
      ([distance, duration]) =>
        new Promise((resolve) => {
          const start = performance.now();
          const from = window.scrollY;
          const step = (t) => {
            const k = Math.min(1, (t - start) / duration);
            window.scrollTo(0, from + distance * (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2));
            k < 1 ? requestAnimationFrame(step) : resolve();
          };
          requestAnimationFrame(step);
        }),
      [dy, ms],
    );
  const go = (p) => page.goto(`${BASE}/${locale}/${p}`, { waitUntil: "networkidle" });
  await run({ take, page, go, glide });
  const meta = await take.finish({ voice });
  process.stdout.write(`${device}/${locale}/${id}: ${meta.seconds} s, ${meta.activeCaptureFps} fps while moving, ${meta.calls.filter((c) => c.status >= 500).length} server errors\n`);
}

await clip("onboarding", async ({ take, page, go, glide }) => {
  await go("s/krizaka-demo");
  await take.start();
  take.beat("open");
  await page.waitForTimeout(1200);
  await glide(260, 1800);
  await take.speak("open");
  take.beat("services");
  await glide(520, 2000);
  await take.speak("services");
  take.beat("clients");
  await go("app/clients");
  await page.waitForTimeout(800);
  await glide(260, 1600);
  await take.speak("clients");
});

await clip("invoice", async ({ take, page, go, glide }) => {
  const english = locale === "en";
  await go("app/invoices");
  await take.start();
  take.beat("form");
  await page.waitForTimeout(900);
  // English: the English-speaking client, 8 h of consulting and a workshop; French: the French-speaking client, 10 h of development and the support plan.
  await choose(page.getByLabel(T.client, { exact: true }), english ? T.nord : T.cafe);
  await page.waitForTimeout(500);
  await choose(page.getByLabel(new RegExp(`^${T.service} 1`)), english ? T.consulting : T.dev);
  await page.getByLabel(T.quantity).nth(0).fill(english ? "8" : "10");
  await page.waitForTimeout(500);
  await choose(page.getByLabel(new RegExp(`^${T.service} 2`)), english ? T.workshop : T.support);
  await page.getByLabel(T.quantity).nth(1).fill("1");
  await page.waitForTimeout(500);
  const language = page.getByLabel(/^(Language of the invoice|Langue de la facture)/);
  await language.selectOption(english ? "en" : "fr");
  await take.speak("form");
  const submit = page.getByRole("button", { name: T.submit });
  await submit.scrollIntoViewIfNeeded();
  await submit.click();
  take.beat("issued");
  const issued = page.getByRole("link", { name: T.open }).first();
  await issued.waitFor({ timeout: 30_000 });
  await issued.scrollIntoViewIfNeeded();
  await take.speak("issued");
  await issued.click();
  await page.waitForURL(/\/app\/invoices\//);
  take.beat("document");
  // The taxes to the cent, on screen: 8 × 180 + 600 = 2 040.00 → GST 102.00, QST 203.49; 10 × 150 + 500 = 2 000.00 → GST 100.00, QST 199.50.
  const totals = english ? ["2,040.00", "102.00", "203.49", "2,345.49"] : ["2 000,00", "100,00", "199,50", "2 299,50"];
  for (const figure of totals) await page.getByText(new RegExp(figure.replace(/[.,]/g, "[.,]").replace(/ /g, "\\s"))).first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(800);
  await glide(260, 1600);
  await take.speak("document");
});

await clip("books", async ({ take, page, go, glide }) => {
  await go("app/invoices");
  await take.start();
  take.beat("list");
  await page.waitForTimeout(900);
  await page.getByRole("heading", { level: 2 }).last().scrollIntoViewIfNeeded();
  await glide(380, 2000);
  await take.speak("list");
  take.beat("sources");
  await go(`app/books?period=${T.period}`);
  await page.waitForTimeout(800);
  await glide(420, 1600);
  for (const summary of await page.locator("summary").all()) {
    await summary.scrollIntoViewIfNeeded();
    await summary.click();
    await page.waitForTimeout(1500);
    if ((await page.locator("details[open]").count()) >= 2) break;
  }
  await take.speak("sources");
});

await clip("return", async ({ take, page, go, glide }) => {
  await go(`app/books?period=${T.period}`);
  await take.start();
  take.beat("top");
  await page.waitForTimeout(1200);
  await glide(320, 1800);
  await take.speak("top");
  take.beat("notFiled");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await page.waitForTimeout(1600);
  await take.speak("notFiled");
});

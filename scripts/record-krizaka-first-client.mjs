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
const BASE = (process.env.APP_BASE_URL ?? "https://www.akinaza.com").replace(/\/$/, "");
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
    today: {
      en: "Éric's day speaks a studio's words: appointments and clients, not a dog walker's walks. The business type decides the vocabulary, and the shop page says so.",
      fr: "La journée d'Éric parle les mots d'un studio : des rendez-vous et des clients, pas les promenades d'un promeneur de chiens. Le type d'entreprise fixe le vocabulaire, et la page de la boutique le dit.",
    },
    clients: {
      en: "Three business clients are on file, each with a recorded consent. Akinaza only prepares taxes; it never files them.",
      fr: "Trois clients d'affaires sont au dossier, chacun avec un consentement noté. Akinaza prépare les taxes; elle ne les produit jamais.",
    },
  },
  invoice: {
    form: {
      en: "Éric issues an invoice from the services themselves: the client, the language, seven and a half hours of one service and one flat-fee line, under the shop's payment terms.",
      fr: "Éric émet une facture à partir des services eux-mêmes : le client, la langue, sept heures et demie d'un service et une ligne à forfait, selon les conditions de paiement de la boutique.",
    },
    issued: {
      en: "Issued. The invoice has its number, and the taxes were computed once, on the taxable total, to the cent.",
      fr: "Émise. La facture a son numéro, et les taxes ont été calculées une seule fois, sur le total taxable, au cent près.",
    },
    document: {
      en: "The document is in the client's language and carries the supplier's GST and QST numbers, the payment terms and the due date: what a business buyer needs to claim its credits.",
      fr: "Le document est dans la langue du client et porte les numéros de TPS et de TVQ du fournisseur, les conditions de paiement et l'échéance : ce dont un acheteur d'affaires a besoin pour réclamer ses crédits.",
    },
  },
  books: {
    list: {
      en: "The books start here: every invoice of the studio, in French or in English, with its due date, subtotal, GST, QST and total.",
      fr: "Les livres commencent ici : chaque facture du studio, en français ou en anglais, avec son échéance, son sous-total, sa TPS, sa TVQ et son total.",
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
  en: { period: "2026-Q3", client: "Client", service: "Service", quantity: "Quantity", addLine: "Add a line", other: "Other line (description)", price: "Unit price", submit: "Issue the invoice", dev: /Software development/, consulting: /Consulting and architecture/, support: /Support and maintenance/, workshop: /Scoping workshop/, nord: /Nord Studio/, lumen: /Studio Lumen/, books: /^Your books$/ },
  fr: { period: "2026-Q3", client: "Client", service: "Service", quantity: "Quantité", addLine: "Ajouter une ligne", other: "Autre ligne (description)", price: "Prix unitaire", submit: "Émettre la facture", dev: /Développement logiciel/, consulting: /Conseil et architecture/, support: /Soutien et maintenance/, workshop: /Atelier de cadrage/, nord: /Nord Studio/, lumen: /Studio Lumen/, books: /^Vos livres$/ },
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
  // The console lives under the shop's id (/app/<shop>/…): only the entrance /app, the invoices and the other lists redirect there, so the
  // id is read once from where /app lands, as a person's browser would carry it.
  let shopBase;
  const go = async (p) => {
    if (p.startsWith("app") && p !== "app" && !shopBase) {
      await page.goto(`${BASE}/${locale}/app`, { waitUntil: "networkidle" });
      shopBase = new URL(page.url()).pathname.match(/\/app\/[0-9a-f-]{36}/)?.[0];
      if (!shopBase) throw new Error(`/app did not land on a shop: ${new URL(page.url()).pathname}`);
    }
    const target = p.startsWith("app/") ? `${shopBase}/${p.slice(4)}` : p === "app" ? "app" : p;
    return page.goto(`${BASE}/${locale}/${target.replace(/^\//, "")}`, { waitUntil: "networkidle" });
  };
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
  take.beat("today");
  await go("app");
  await page.waitForTimeout(1200);
  await glide(220, 1400);
  await go("app/settings");
  await page.waitForTimeout(800);
  await glide(520, 2200);
  await take.speak("today");
  take.beat("clients");
  await go("app/clients");
  await page.waitForTimeout(800);
  await glide(260, 1600);
  await take.speak("clients");
});

await clip("invoice", async ({ take, page, go, glide }) => {
  const english = locale === "en";
  await go("app/invoices/new");
  await take.start();
  take.beat("form");
  await page.waitForTimeout(900);
  // English: the English-speaking client, 7.5 h of consulting and a workshop; French: the French-speaking client, 7,5 h of development and the support plan.
  await choose(page.getByLabel(T.client, { exact: true }), english ? T.nord : T.lumen);
  await page.waitForTimeout(500);
  await choose(page.getByLabel(T.service, { exact: true }).nth(0), english ? T.consulting : T.dev);
  await page.getByLabel(T.quantity).nth(0).fill(english ? "7.5" : "7,5");
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: T.addLine }).click();
  await choose(page.getByLabel(T.service, { exact: true }).nth(1), english ? T.workshop : T.support);
  await page.getByLabel(T.quantity).nth(1).fill("1");
  await page.waitForTimeout(500);
  await take.speak("form");
  const submit = page.getByRole("button", { name: T.submit });
  await submit.scrollIntoViewIfNeeded();
  await submit.click();
  take.beat("issued");
  // Issuing opens the invoice itself (?issued=1): no list to click through any more.
  await page.waitForURL(/\/invoices\/[0-9a-f-]{36}/, { timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  await take.speak("issued");
  take.beat("document");
  // The taxes to the cent, on screen: 7.5 × 180 + 600 = 1 950.00 → GST 97.50, QST 194.51 (194.5125); 7,5 × 150 + 500 = 1 625,00 → GST 81,25, QST 162,09 (162.09375).
  const totals = english ? ["1,950.00", "97.50", "194.51", "2,242.01"] : ["1 625,00", "81,25", "162,09", "1 868,34"];
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
  await page.getByRole("table").first().scrollIntoViewIfNeeded(); // the list is a table; it has no level-2 heading
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

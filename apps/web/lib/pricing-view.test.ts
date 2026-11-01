import { readFileSync } from "node:fs";

import { findTypedPrices, memoryPriceStore, priceCatalogue, publicCatalogue } from "@krizaka/settings";
import { describe, expect, it } from "vitest";

import en from "../messages/en.json";
import fr from "../messages/fr.json";
import { format } from "./i18n";
import { ASSOCIATION, FOUNDER, PRICES, SCALE, STARTER } from "./pricing";
import { planAction, pricingPlans, subscriptionPlans } from "./pricing-view";
import { pricesInForce } from "./test-prices";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const NOW = new Date("2026-11-01T12:00:00Z");
const ADMIN = { id: null, label: "admin@example.com" };
const inForce = () => pricesInForce(NOW);
const view = async (prices?: Awaited<ReturnType<typeof inForce>>, locale: "en" | "fr" = "en", founderOnSale = false) => pricingPlans(publicCatalogue(await (prices ?? (await inForce())).catalogue(NOW)), locale, { founderOnSale });

describe("the public pricing page reads the catalogue (akinaza#380)", () => {
  it("shows Starter at 29 $ (three free months), Pro at 69 $ and Association at 1 $, with the fees of the catalogue: 0 % on cards, the capped debit fee", async () => {
    const [starter, scale, association, ...rest] = await view();
    expect(rest).toEqual([]);
    expect([starter!.id, starter!.price, scale!.id, scale!.price, association!.id, association!.price]).toEqual(["starter", "$29", "scale", "$69", "association", "$1"]);
    expect(starter!.features.find((f) => f.id === "fees")!.vars).toEqual({ cardRate: "0%", debitRate: "0.5%", debitCap: "$15" });
    expect(scale!.features.find((f) => f.id === "fees")!.vars).toEqual({ cardRate: "0%", debitRate: "0.25%", debitCap: "$10" });
    expect((await view(undefined, "fr"))[0]!.price!.replace(/\s/g, " ")).toBe("29 $");
  });

  it("Starter and Association start with three free months, read from the catalogue; Pro has none", async () => {
    const [starter, scale, association] = await view();
    expect(starter!.trial).toEqual({ days: 90, months: 3 });
    expect(association!.trial).toEqual({ days: 90, months: 3 });
    expect(scale!.trial).toBeNull();
    // The administrator changes the trial from the console: the page follows.
    const prices = await inForce();
    const entry = await prices.entry(STARTER, NOW);
    await prices.schedule(ADMIN, STARTER, { limits: { ...entry.limits, trialDays: 60 } }, NOW, NOW);
    expect((await view(prices))[0]!.trial).toEqual({ days: 60, months: 2 });
    await prices.schedule(ADMIN, STARTER, { limits: { ...entry.limits, trialDays: 0 } }, NOW, NOW);
    expect((await view(prices))[0]!.trial).toBeNull();
  });

  it("the Association plan lists the Starter features, and a plan in preparation shows no trial", async () => {
    const [, , association] = await view();
    expect(association!.features.filter((f) => !f.soon).map((f) => f.id)).toEqual(["inherits"]);
    const prices = await inForce();
    await prices.schedule(ADMIN, ASSOCIATION, { availability: "preparing" }, NOW, NOW);
    const hidden = (await view(prices)).find((p) => p.id === "association")!;
    expect([hidden.price, hidden.trial]).toEqual([null, null]);
  });

  it("a price changed in the catalogue changes the page", async () => {
    const prices = await inForce();
    await prices.schedule(ADMIN, STARTER, { amountCents: 5900 }, NOW, NOW);
    const entry = await prices.entry(STARTER, NOW);
    await prices.schedule(ADMIN, SCALE, { limits: { ...entry.limits, directDebitCapCents: 2000 } }, NOW, NOW);
    const [starter, scale] = await view(prices);
    expect(starter!.price).toBe("$59");
    expect(scale!.features.find((f) => f.id === "fees")!.vars.debitCap).toBe("$20");
  });

  it("a plan in preparation has no figure, an internal one is not shown", async () => {
    const prices = await inForce();
    await prices.schedule(ADMIN, SCALE, { availability: "preparing" }, NOW, NOW);
    await prices.schedule(ADMIN, STARTER, { availability: "internal" }, NOW, NOW);
    await prices.schedule(ADMIN, ASSOCIATION, { availability: "internal" }, NOW, NOW);
    const plans = await view(prices);
    expect(plans.map((p) => p.id)).toEqual(["scale"]);
    expect(plans[0]!.price).toBeNull();
  });

  it("shows the founder offer only while it is on sale, with its cap read from the catalogue", async () => {
    // The founder offer ends with the new grid (the prices migration makes its entry internal): the seed alone, before that, still shows it.
    expect((await view()).map((p) => p.id)).toEqual(["starter", "scale", "association"]);
    const seedOnly = priceCatalogue(PRICES, memoryPriceStore());
    const plans = await view(seedOnly as never, "en", true);
    expect(plans.map((p) => p.id)).toEqual(["founder", "starter", "scale", "association"]);
    expect(plans[0]).toMatchObject({ price: "$39", limit: 20 });
    await seedOnly.schedule(ADMIN, FOUNDER, { availability: "internal" }, NOW, NOW);
    expect((await view(seedOnly as never, "en", true)).map((p) => p.id)).toEqual(["starter", "scale", "association"]);
  });

  it("a feature that is not built is flagged soon, and carries no figure unless it is a stated rate", async () => {
    const plans = await view();
    expect(plans[0]!.features.filter((f) => f.soon).map((f) => f.id)).toEqual(["payments", "fees"]);
    expect(plans[2]!.features.filter((f) => f.soon).map((f) => f.id)).toEqual(["payments", "fees"]);
    expect(plans[1]!.features.filter((f) => f.soon).map((f) => f.id)).toEqual(["payments", "fees", "contract", "transfers"]);
    for (const f of plans.flatMap((p) => p.features.filter((x) => x.soon && x.id !== "fees"))) {
      expect(f.vars, f.id).toEqual({});
      for (const t of [en, fr]) {expect(t.pricing.features[f.id], f.id).not.toMatch(/\d+\s?[%$]|\$\s?\d|\{/);}
    }
  });

  it("lists as running only what runs: client payments, their fees, the contract and the transfers are all planned (akinaza#440)", async () => {
    for (const plan of await view()) {
      const running = plan.features.filter((f) => !f.soon).map((f) => f.id);
      for (const planned of ["payments", "fees", "contract", "transfers"] as const) {expect(running, `${plan.id} ${planned}`).not.toContain(planned);}
    }
  });

  it("the plan above Starter lists only what differs: everything in Starter, then its planned features", async () => {
    const [starter, scale] = await view();
    expect(starter!.features.filter((f) => !f.soon).map((f) => f.id)).toEqual(["booking", "invoices", "books"]);
    expect(scale!.features.filter((f) => !f.soon).map((f) => f.id)).toEqual(["inherits"]);
  });
});

describe("the page and its messages", () => {
  it("types no amount in a message", () => {
    expect(findTypedPrices({ en: en.pricing, fr: fr.pricing })).toEqual([]);
    expect(JSON.stringify([en.pricing, fr.pricing])).not.toMatch(/\d+ ?\$|\$ ?\d/);
  });

  it("is a public page: in the bar, the footer, the sitemap and llms.txt, and follows the home's founder switch and sign-up status", () => {
    const page = read("app/[locale]/pricing/page.tsx");
    expect(page).toContain("APP_FOUNDER_OFFER_ENABLED");
    expect(page).toContain("heroActions(");
    expect(read("lib/site.ts")).toContain('"pricing"');
    expect(read("components/SiteChrome.tsx")).toContain('pricing: pagePath(locale, "pricing")');
    expect(read("components/SiteFooter.tsx")).toContain('pagePath(locale, "pricing")');
    expect(read("lib/seo.ts")).toContain("/en/pricing");
  });

  it("promises no custody of funds and no filing, in both languages", () => {
    const text = JSON.stringify([en.pricing, fr.pricing]);
    expect(text).not.toMatch(/escrow|séquestre|\bAI\b|\bIA\b/i);
    expect(en.pricing.faq.map((f) => f.a).join(" ")).toMatch(/Never\./);
    expect(en.pricing.faq.map((f) => f.a).join(" ")).toMatch(/you file them/);
  });
});

describe("the plan names are plain words (akinaza#440)", () => {
  it("has no « Scale B2B » jargon on the public page or the home, in either language", () => {
    for (const t of [en, fr]) {
      expect(t.pricing.plans.scale).toBe("Pro");
      expect(t.landing.founder.plans.scale).toBe("Pro");
    }
  });
});

describe("the free months and the Association plan, in words (founder request 2026-10-30)", () => {
  it("says « 3 mois offerts » and « Associations : 3 mois gratuits, puis 1 $ par mois », taxes stated, from the catalogue's figures", async () => {
    const [starter, , association] = await view(undefined, "fr");
    const trial = format(fr.pricing.trialMonths, { months: starter!.trial!.months! });
    expect(trial).toBe("3 mois offerts");
    expect(format(fr.pricing.trialLine, { trial, price: starter!.price! }).replace(/\s/g, " ")).toBe("3 mois offerts, puis 29 $ par mois, taxes en sus. Vous saisissez votre carte pour commencer : rien n’est facturé pendant la période offerte, et vous pouvez résilier avant sa fin.");
    expect(format(fr.pricing.associationLine, { months: association!.trial!.months!, price: association!.price! }).replace(/\s/g, " ")).toMatch(/^Associations : 3 mois gratuits, puis 1 \$ par mois, taxes en sus\./);
    const [en1, , enAssociation] = await view(undefined, "en");
    expect(format(en.pricing.trialMonths, { months: en1!.trial!.months! })).toBe("3 months free");
    expect(format(en.pricing.associationLine, { months: 3, price: enAssociation!.price! })).toMatch(/^Associations: 3 months free, then \$1 a month plus taxes\./);
  });

  it("every text with a price states the taxes, and none presses the visitor (no countdown, no scarcity)", () => {
    for (const t of [en, fr]) {
      const texts = [t.pricing.trialLine, t.pricing.associationLine, t.pricing.associationLineDays, t.console.account.subscription.planHint, t.console.account.subscription.planHintTrial, t.console.account.subscription.associationHint];
      for (const text of texts) {expect(text, text).toMatch(/plus taxes|taxes en sus/);}
      expect(JSON.stringify([t.pricing, t.console.account.subscription])).not.toMatch(/last chance|hurry|ends (today|soon)|only \d+ left|dernière chance|vite|plus que \d+|se termine bientôt/i);
    }
  });

  it("keeps the « Soon » items: client payments, the fees, the contract and the transfers stay planned, not ticked", async () => {
    for (const plan of await view()) {
      const soon = plan.features.filter((f) => f.soon).map((f) => f.id);
      expect(soon, plan.id).toContain("payments");
    }
    expect(en.pricing.soon).toBe("Soon");
    expect(fr.pricing.soon).toBe("Bientôt");
  });
});

describe("the Subscription page and /pricing sell the same plans (krizaka-internal#1913)", () => {
  it.each(["en", "fr"] as const)("every plan of the Subscription page is a plan of /pricing, with its price and free months (%s)", async (locale) => {
    const pricing = await view(undefined, locale, true);
    const sold = subscriptionPlans(pricing);
    expect(sold.map((p) => p.id)).toEqual(["starter", "scale", "association"]);
    for (const plan of sold) {
      const shown = pricing.find((p) => p.id === plan.id)!;
      expect({ price: plan.price, trial: plan.trial }).toEqual({ price: shown.price, trial: shown.trial });
    }
    expect(sold.find((p) => p.id === "starter")).toMatchObject({ trial: { months: 3, days: 90 } });
  });

  it("a plan in preparation is not sold, and the founder flag does not hide the plans on the Subscription page", () => {
    expect(subscriptionPlans([{ id: "scale", price: null, limit: null, trial: null, features: [] }])).toEqual([]);
    expect(read("app/[locale]/(app)/app/(account)/profile/subscription/page.tsx")).not.toMatch(/canStart = e\.APP_FOUNDER_OFFER_ENABLED/);
  });
});

describe("a signed-in owner is sent to Subscription, not to « Open my shop » (krizaka-internal#1913)", () => {
  it("leads an owner and the Association plan to Subscription, a visitor to the demo", () => {
    expect([planAction(true, false), planAction(false, true), planAction(false, false)]).toEqual(["subscription", "subscription", "visit"]);
  });

  it("words the owner's action in both languages", () => {
    expect([en.pricing.manageCta, fr.pricing.manageCta]).toEqual(["Manage my plan", "Gérer mon forfait"]);
  });
});

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { scheduledPrice } from "@akinaza/db";
import { findTypedPrices } from "@krizaka/settings";
import { describe, expect, it } from "vitest";

import en from "../messages/en.json";
import fr from "../messages/fr.json";
import { readEnv } from "./env";
import { plansView } from "./founder-offer";
import { paymentsFrom } from "./payments/config";
import { publicPrices } from "./price-catalogue";
import { ASSOCIATION, cardFeeCents, directDebitFeeCents, FOUNDER, type PriceKey, PRICES, PROCESSOR_PLANS, SCALE, STARTER } from "./pricing";
import { SETTINGS } from "./settings";
import { pricesInForce } from "./test-prices";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const catalogue = JSON.parse(read("infra/payments/catalogue.json")) as { plans: Array<Record<string, unknown>> };

/** Every source file under a folder (tests excluded), for the « never a fee » scan. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" || name === ".next" ? [] : sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

describe("the seed of the catalogue is the history: the founder offer, Starter and Scale as first sold, and the new Association entry (akinaza#371, ADR-009)", () => {
  it("the founder offer 39 $ a month for the first 20 businesses; Starter 45 $ and Scale B2B 99 $ a month, public — CAD, plus taxes", () => {
    expect(PRICES.keys).toEqual([FOUNDER, STARTER, SCALE, ASSOCIATION]);
    expect(PRICES.defaultOf(FOUNDER)).toEqual({ unit: "month", amountCents: 3900, currency: "CAD", taxes: "plus-taxes", availability: "founder-limited", limits: { founderCap: 20, cardFeeBps: 0, directDebitBps: 50, directDebitCapCents: 1500 } });
    expect(PRICES.defaultOf(STARTER)).toEqual({ unit: "month", amountCents: 4500, currency: "CAD", taxes: "plus-taxes", availability: "public", limits: { cardFeeBps: 0, directDebitBps: 50, directDebitCapCents: 1500 } });
    expect(PRICES.defaultOf(SCALE)).toEqual({ unit: "month", amountCents: 9900, currency: "CAD", taxes: "plus-taxes", availability: "public", limits: { cardFeeBps: 0, directDebitBps: 25, directDebitCapCents: 1000 } });
    // The seed is never rewritten (a subscriber sold at `seed:akinaza.starter` keeps 45 $): the new grid is a dated version of the catalogue.
    expect(PRICES.defaultOf(ASSOCIATION)).toEqual({ unit: "month", amountCents: 100, currency: "CAD", taxes: "plus-taxes", availability: "public", limits: { trialDays: 90, cardFeeBps: 0, directDebitBps: 50, directDebitCapCents: 1500 } });
  });

  it("the grid in force: Starter 29 $ with 90 free days, Pro 69 $, Association 1 $ with 90 free days, the founder offer ended", async () => {
    const at = new Date("2026-11-01T12:00:00Z");
    const prices = await pricesInForce(at);
    expect((await prices.entry(STARTER, at)).amountCents).toBe(2900);
    expect((await prices.entry(STARTER, at)).limits.trialDays).toBe(90);
    expect((await prices.entry(SCALE, at)).amountCents).toBe(6900);
    expect((await prices.entry(SCALE, at)).limits.trialDays).toBeUndefined();
    expect(await prices.entry(ASSOCIATION, at)).toMatchObject({ amountCents: 100, availability: "public" });
    expect((await prices.entry(FOUNDER, at)).availability).toBe("internal");
    // Existing subscribers keep the version they were sold at.
    expect((await prices.version("seed:akinaza.starter"))?.amountCents).toBe(4500);
    expect((await prices.version("seed:akinaza.founder"))?.amountCents).toBe(3900);
  });

  it("0 % on cards in every entry: a card payment of any order carries no fee", () => {
    for (const key of PRICES.keys) {
      const price = PRICES.defaultOf(key);
      expect(price.limits.cardFeeBps, key).toBe(0);
      for (const order of [0, 1, 999, 4500, 1_000_000]) expect(cardFeeCents(price, order), key).toBe(0);
    }
  });

  it("the pre-authorised debit fee of any order is at most the entry's cap, in every entry", () => {
    for (const key of PRICES.keys) {
      const price = PRICES.defaultOf(key);
      for (const order of [0, 1, 4500, 199_999, 200_000, 300_000, 400_000, 10_000_000, 99_999_999]) expect(directDebitFeeCents(price, order), key).toBeLessThanOrEqual(price.limits.directDebitCapCents);
    }
  });

  it("the pre-authorised debit fee is the entry's rate of the order, capped per order (at and around the cap)", () => {
    const starter = PRICES.defaultOf(STARTER); // 0,50 %, capped at 15 $
    expect(directDebitFeeCents(starter, 0)).toBe(0);
    expect(directDebitFeeCents(starter, 10_000)).toBe(50);
    expect(directDebitFeeCents(starter, 299_800)).toBe(1499);
    expect(directDebitFeeCents(starter, 300_000)).toBe(1500); // exactly at the cap
    expect(directDebitFeeCents(starter, 300_200)).toBe(1500);
    expect(directDebitFeeCents(starter, 50_000_000)).toBe(1500);
    const scale = PRICES.defaultOf(SCALE); // 0,25 %, capped at 10 $
    expect(directDebitFeeCents(scale, 399_800)).toBe(1000);
    expect(directDebitFeeCents(scale, 400_000)).toBe(1000);
    expect(directDebitFeeCents(scale, 400_400)).toBe(1000);
    expect(directDebitFeeCents(scale, 200_000)).toBe(500);
    for (const bad of [-1, 1.5, Number.NaN]) expect(() => directDebitFeeCents(starter, bad)).toThrow(RangeError);
  });

  it("the processor's catalogue sells exactly the amounts in force (seed plus the prices schedule), monthly, by the lookup keys of the payments port", () => {
    expect(catalogue.plans.map((p) => p.lookupKey).sort()).toEqual(Object.values(PROCESSOR_PLANS).map((p) => p.lookupKey).sort());
    for (const key of PRICES.keys) {
      const price = scheduledPrice(key, PRICES.defaultOf(key));
      expect(catalogue.plans.find((p) => p.lookupKey === PROCESSOR_PLANS[key as PriceKey].lookupKey), key).toMatchObject({ amount: price.amountCents, currency: "cad", interval: price.unit });
    }
  });

  it("the environment's default lookup keys are the processor plans', and the payments port reads both plans", async () => {
    const e = readEnv({});
    expect(e.PAYMENTS_PRICE_KEY_STARTER).toBe(PROCESSOR_PLANS[STARTER].lookupKey);
    expect(e.PAYMENTS_PRICE_KEY_SCALE).toBe(PROCESSOR_PLANS[SCALE].lookupKey);
    expect(e.PAYMENTS_PRICE_KEY_ASSOCIATION).toBe(PROCESSOR_PLANS[ASSOCIATION].lookupKey);
    const port = paymentsFrom({ ...e, PAYMENTS_PROVIDER: "stripe", PAYMENTS_STRIPE_SECRET_KEY: "x", PAYMENTS_STRIPE_WEBHOOK_SECRET: "y" });
    await expect(port!.price("unknown")).rejects.toThrow(/Unknown plan/);
  });

  it("the public view never shows an internal entry, and an entry in preparation shows without a figure", async () => {
    const now = new Date("2026-11-01T12:00:00Z");
    const prices = await pricesInForce(now);
    expect(plansView(await publicPrices(prices, now), "en")).toEqual({ starter: { price: "$29" }, scale: { price: "$69" } });
    await prices.schedule({ id: null, label: "admin" }, SCALE, { availability: "preparing" }, now, now);
    const preparing = await publicPrices(prices, now);
    expect(preparing.find((e) => e.key === SCALE)).toMatchObject({ availability: "preparing", amountCents: null, limits: {} });
    expect(plansView(preparing, "en").scale).toEqual({ price: null });
    // The administrator ends the founder offer and hides Scale: neither is shown any more.
    await prices.schedule({ id: null, label: "admin" }, FOUNDER, { availability: "internal" }, now, now);
    await prices.schedule({ id: null, label: "admin" }, SCALE, { availability: "internal" }, now, now);
    const later = await publicPrices(prices, now);
    expect(later.map((e) => e.key)).toEqual([STARTER, ASSOCIATION]);
    expect(later.map((e) => e.availability)).not.toContain("internal");
    expect(plansView(later, "fr").scale).toBeNull();
  });

  it("the former setting `plans.founder.limit` is retired: the cap has one source, the Starter entry", () => {
    expect(Object.keys(SETTINGS)).not.toContain("plans.founder.limit");
    const files = [...sources(join(ROOT, "apps/web/lib")), ...sources(join(ROOT, "apps/web/components")), ...sources(join(ROOT, "apps/web/app"))];
    for (const file of files) expect(readFileSync(file, "utf8"), file).not.toMatch(/["']plans\.founder\.limit["']/);
  });
});

describe("every price shown says « plus taxes », and none is typed in a message (akinaza#363, #371)", () => {
  const SAYS_TAXES = /plus (GST|TPS|taxes)|taxes (extra|en sus)|before tax|avant taxes/i;

  it("no message types an amount, in either language (findTypedPrices)", () => {
    expect(findTypedPrices(en)).toEqual([]);
    expect(findTypedPrices(fr)).toEqual([]);
    // The guard itself catches a typed amount.
    expect(findTypedPrices({ a: { b: "45 $ par mois" }, c: ["$99 a month"] })).toEqual(["a.b", "c.0"]);
  });

  it("each text that carries a {price} says the taxes are extra", () => {
    const texts: string[] = [];
    for (const m of [en, fr]) {
      texts.push(m.landing.founder.title, ...m.landing.founder.points, m.landing.founder.plans.price, m.console.account.subscription.founderHint, m.console.account.subscription.priceLine);
    }
    const priced = texts.filter((t) => t.includes("{price}"));
    expect(priced.length).toBe(10);
    for (const t of priced) expect(t, t).toMatch(SAYS_TAXES);
  });

  it("the offer says « 0 % on cards » from the catalogue's card rate", () => {
    expect(en.landing.founder.points.some((p) => p.startsWith("{cardRate} on cards"))).toBe(true);
    expect(fr.landing.founder.points.some((p) => p.startsWith("{cardRate} sur les cartes"))).toBe(true);
    expect(en.console.account.subscription.founderHint).toContain("{cardRate} on cards");
    expect(fr.console.account.subscription.founderHint).toContain("{cardRate} sur les cartes");
  });

  it("no claim of conformity, hosting place, uptime or escrow in the pricing words; Scale's B2B features are « soon »", () => {
    for (const m of [en, fr]) expect(JSON.stringify([m.landing.founder, m.console.account.subscription, m.console.admin.prices])).not.toMatch(/PIPEDA|Loi 25|Law 25|conform|hébergé au|hosted in|uptime|disponibilité de \d|99[.,]9|séquestre|escrow/i);
    expect(en.landing.founder.plans.scaleSoon).toMatch(/coming soon/);
    expect(fr.landing.founder.plans.scaleSoon).toMatch(/bientôt/);
  });

  it("the seed is the only place a plan amount is written (no 4500 or 9900 elsewhere in the web sources)", () => {
    const files = [...sources(join(ROOT, "apps/web/lib")), ...sources(join(ROOT, "apps/web/components")), ...sources(join(ROOT, "apps/web/app"))].filter((f) => !f.endsWith("lib/pricing.ts"));
    for (const file of files) expect(readFileSync(file, "utf8"), file).not.toMatch(/\b(4500|9900|3900|4900)\b/);
  });
});

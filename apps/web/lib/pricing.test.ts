import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { stripeAdapter } from "@krizaka/payments";
import { findTypedPrices, memoryPriceStore, priceCatalogue } from "@krizaka/settings";
import { describe, expect, it } from "vitest";

import en from "../messages/en.json";
import fr from "../messages/fr.json";
import { readEnv } from "./env";
import { scaleView } from "./founder-offer";
import { paymentsFrom } from "./payments/config";
import { publicPrices } from "./price-catalogue";
import { cardFeeCents, directDebitFeeCents, type PriceKey, PRICES, PROCESSOR_PLANS, SCALE, STARTER } from "./pricing";
import { SETTINGS } from "./settings";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const catalogue = JSON.parse(read("payments/catalogue.json")) as { plans: Array<Record<string, unknown>> };

/** Every source file under a folder (tests excluded), for the « never a fee » scan. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" || name === ".next" ? [] : sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

describe("the seed of the catalogue: Starter and Scale (akinaza#371, ADR-009)", () => {
  it("Starter 45 $ a month, founder-limited to the first 20 businesses; Scale B2B 99 $ a month, in preparation — CAD, plus taxes", () => {
    expect(PRICES.keys).toEqual([STARTER, SCALE]);
    expect(PRICES.defaultOf(STARTER)).toEqual({ unit: "month", amountCents: 4500, currency: "CAD", taxes: "plus-taxes", availability: "founder-limited", limits: { founderCap: 20, cardFeeBps: 0, directDebitBps: 50, directDebitCapCents: 1500 } });
    expect(PRICES.defaultOf(SCALE)).toEqual({ unit: "month", amountCents: 9900, currency: "CAD", taxes: "plus-taxes", availability: "preparing", limits: { cardFeeBps: 0, directDebitBps: 25, directDebitCapCents: 1000 } });
  });

  it("0 % on cards in every entry: a card payment of any order carries no fee", () => {
    for (const key of PRICES.keys) {
      const price = PRICES.defaultOf(key);
      expect(price.limits.cardFeeBps, key).toBe(0);
      for (const order of [0, 1, 999, 4500, 1_000_000]) expect(cardFeeCents(price, order), key).toBe(0);
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

  it("the processor's catalogue sells exactly the seed's amounts, monthly, by the lookup keys of the payments port", () => {
    expect(catalogue.plans.map((p) => p.lookupKey).sort()).toEqual(Object.values(PROCESSOR_PLANS).map((p) => p.lookupKey).sort());
    for (const key of PRICES.keys) {
      const price = PRICES.defaultOf(key);
      expect(catalogue.plans.find((p) => p.lookupKey === PROCESSOR_PLANS[key as PriceKey].lookupKey), key).toMatchObject({ amount: price.amountCents, currency: "cad", interval: price.unit });
    }
  });

  it("the environment's default lookup keys are the processor plans', and the payments port reads both plans", async () => {
    const e = readEnv({});
    expect(e.PAYMENTS_PRICE_KEY_STARTER).toBe(PROCESSOR_PLANS[STARTER].lookupKey);
    expect(e.PAYMENTS_PRICE_KEY_SCALE).toBe(PROCESSOR_PLANS[SCALE].lookupKey);
    const port = paymentsFrom({ ...e, PAYMENTS_PROVIDER: "stripe", PAYMENTS_STRIPE_SECRET_KEY: "x", PAYMENTS_STRIPE_WEBHOOK_SECRET: "y" });
    await expect(port!.price("unknown")).rejects.toThrow(/Unknown plan/);
  });

  it("the public view never shows an internal entry, and Scale shows without a figure while in preparation", async () => {
    const prices = priceCatalogue(PRICES, memoryPriceStore());
    const now = new Date("2026-11-01T12:00:00Z");
    const shown = await publicPrices(prices, now);
    const scale = shown.find((e) => e.key === SCALE)!;
    expect(scale).toMatchObject({ availability: "preparing", amountCents: null, limits: {} });
    expect(scaleView(shown, "en")).toEqual({ price: null });
    await prices.schedule({ id: null, label: "admin" }, SCALE, { availability: "internal" }, now, now);
    const later = await publicPrices(prices, now);
    expect(later.map((e) => e.key)).toEqual([STARTER]);
    expect(scaleView(later, "fr")).toBeNull();
    expect(later.map((e) => e.availability)).not.toContain("internal");
    expect(later.map((e) => e.amountCents)).toEqual([4500]);
  });

  it("the former setting `plans.founder.limit` is retired: the cap has one source, the Starter entry", () => {
    expect(Object.keys(SETTINGS)).not.toContain("plans.founder.limit");
    const files = [...sources(join(ROOT, "apps/web/lib")), ...sources(join(ROOT, "apps/web/components")), ...sources(join(ROOT, "apps/web/app"))];
    for (const file of files) expect(readFileSync(file, "utf8"), file).not.toMatch(/["']plans\.founder\.limit["']/);
  });
});

describe("no processor fee on what a business's clients pay (akinaza#363)", () => {
  it("every plan of the catalogue is a flat monthly subscription: no field for a percentage, a fee or a usage price", () => {
    const allowed = new Set(["lookupKey", "name", "amount", "currency", "interval", "taxCode"]);
    for (const plan of catalogue.plans) {
      expect(Object.keys(plan).filter((k) => !allowed.has(k)), String(plan.lookupKey)).toEqual([]);
      expect(plan.interval).toBe("month");
    }
    // The fees a business's clients may carry are the catalogue's named limits (0 on cards), never a processor field.
    expect(JSON.stringify(catalogue)).not.toMatch(/fee|percent|commission|bps|usage|metered/i);
  });

  it("the checkout never asks the processor for an application fee or a transfer", () => {
    const files = [...sources(join(ROOT, "apps/web/lib")), ...sources(join(ROOT, "apps/web/app/api/billing")), ...sources(join(ROOT, "apps/web/app/api/webhooks"))];
    expect(files.length).toBeGreaterThan(5);
    for (const file of files) expect(readFileSync(file, "utf8"), file).not.toMatch(/application_fee|transfer_data|on_behalf_of|fee_percent|commission/i);
  });

  it("the shared adapter sends none either: its request builder has no fee field", () => {
    const entry = fileURLToPath(import.meta.resolve("@krizaka/payments"));
    const dir = join(entry, "..");
    const dist = existsSync(dir) ? readdirSync(dir).filter((f) => /\.(js|mjs)$/.test(f)) : [];
    expect(dist.length).toBeGreaterThan(0);
    for (const f of dist) expect(readFileSync(join(dir, f), "utf8"), f).not.toMatch(/application_fee|transfer_data|on_behalf_of/);
    expect(typeof stripeAdapter).toBe("function");
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
      texts.push(m.landing.founder.title, ...m.landing.founder.points, m.landing.founder.scale.price, m.console.account.subscription.founderHint, m.console.account.subscription.priceLine);
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

  it("no claim of conformity, hosting place or uptime in the pricing words", () => {
    for (const m of [en, fr]) expect(JSON.stringify([m.landing.founder, m.console.account.subscription, m.console.admin.prices])).not.toMatch(/PIPEDA|Loi 25|Law 25|conform|hébergé au|hosted in|uptime|disponibilité de \d|99[.,]9/i);
  });

  it("the seed is the only place a plan amount is written (no 4500 or 9900 elsewhere in the web sources)", () => {
    const files = [...sources(join(ROOT, "apps/web/lib")), ...sources(join(ROOT, "apps/web/components")), ...sources(join(ROOT, "apps/web/app"))].filter((f) => !f.endsWith("lib/pricing.ts"));
    for (const file of files) expect(readFileSync(file, "utf8"), file).not.toMatch(/\b(4500|9900|3900|4900)\b/);
  });
});

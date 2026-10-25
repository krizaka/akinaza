import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { stripeAdapter } from "@krizaka/payments";
import { describe, expect, it } from "vitest";

import en from "../messages/en.json";
import fr from "../messages/fr.json";
import { readEnv } from "./env";
import { paymentsFrom } from "./payments/config";
import { PLANS, publicPlans } from "./pricing";
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

describe("the prices come from one module, and the processor's catalogue equals it (akinaza#363)", () => {
  it("founder 39 $ a month, regular 49 $ a month, both in Canadian dollars, taxes extra", () => {
    expect(PLANS.founder).toMatchObject({ cents: 3900, currency: "cad", interval: "month" });
    expect(PLANS.regular).toMatchObject({ cents: 4900, currency: "cad", interval: "month" });
  });

  it("the catalogue holds exactly the plans of the module: same key, amount, currency and interval", () => {
    expect(catalogue.plans.map((p) => p.lookupKey).sort()).toEqual(Object.values(PLANS).map((p) => p.lookupKey).sort());
    for (const plan of Object.values(PLANS)) {
      expect(catalogue.plans.find((p) => p.lookupKey === plan.lookupKey)).toMatchObject({ amount: plan.cents, currency: plan.currency, interval: plan.interval });
    }
  });

  it("the environment's default lookup keys are the module's, and the payments port reads both plans", async () => {
    const e = readEnv({});
    expect(e.PAYMENTS_PRICE_KEY_FOUNDER).toBe(PLANS.founder.lookupKey);
    expect(e.PAYMENTS_PRICE_KEY_REGULAR).toBe(PLANS.regular.lookupKey);
    const port = paymentsFrom({ ...e, PAYMENTS_PROVIDER: "stripe", PAYMENTS_STRIPE_SECRET_KEY: "x", PAYMENTS_STRIPE_WEBHOOK_SECRET: "y" });
    await expect(port!.price("unknown")).rejects.toThrow(/Unknown plan/);
  });

  it("the regular plan is in the catalogue and is not shown while sign-up is closed", () => {
    expect(PLANS.regular.public).toBe(false);
    expect(Object.keys(publicPlans())).toEqual(["founder"]);
    // No message and no public component reads the regular plan: nothing to show until it is made public.
    for (const m of [en, fr]) expect(JSON.stringify([m.landing, m.console.account.subscription])).not.toMatch(/\b49\b|regular|régulier|habituel/i);
    for (const f of ["components/home/FounderOffer.tsx", "components/account/SubscriptionPanel.tsx", "app/[locale]/page.tsx"]) expect(read(`apps/web/${f}`), f).not.toMatch(/PLANS\.regular|akinaza_regular/);
  });
});

describe("no fee on what a business's clients pay, ever (akinaza#363)", () => {
  it("every plan of the catalogue is a flat monthly subscription: no field for a percentage, a fee or a usage price", () => {
    const allowed = new Set(["lookupKey", "name", "amount", "currency", "interval", "taxCode"]);
    for (const plan of catalogue.plans) {
      expect(Object.keys(plan).filter((k) => !allowed.has(k)), String(plan.lookupKey)).toEqual([]);
      expect(plan.interval).toBe("month");
    }
    expect(JSON.stringify(PLANS)).not.toMatch(/fee|percent|commission|bps|usage|metered/i);
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

describe("every price shown says « plus taxes », and none is typed in a message (akinaza#363)", () => {
  const PRICES = /\d[\d\s.,]*\s?\$|\$\s?\d/; // \s covers the non-breaking space of French amounts
  const SAYS_TAXES = /plus (GST|TPS|taxes)|taxes (extra|en sus)|before tax|avant taxes/i;

  it("no amount in the founder offer or the subscription page, in either language", () => {
    for (const m of [en, fr]) for (const group of [m.landing.founder, m.console.account.subscription]) expect(JSON.stringify(group)).not.toMatch(PRICES);
  });

  it("each text that carries a {price} says the taxes are extra", () => {
    const texts: string[] = [];
    for (const m of [en, fr]) {
      texts.push(m.landing.founder.title, ...m.landing.founder.points, m.console.account.subscription.founderHint);
    }
    const priced = texts.filter((t) => t.includes("{price}"));
    expect(priced.length).toBe(6);
    for (const t of priced) expect(t, t).toMatch(SAYS_TAXES);
  });

  it("the module of prices is the only place a plan amount is written (no 3900 or 4900 elsewhere in the web sources)", () => {
    const files = [...sources(join(ROOT, "apps/web/lib")), ...sources(join(ROOT, "apps/web/components")), ...sources(join(ROOT, "apps/web/app"))].filter((f) => !f.endsWith("lib/pricing.ts"));
    for (const file of files) expect(readFileSync(file, "utf8"), file).not.toMatch(/\b(3900|4900)\b/);
  });
});

describe("the founder offer's limit is a setting (akinaza#363)", () => {
  it("defaults to the first 20 businesses, is global, and refuses a non-whole number or a value outside its bounds", () => {
    const limit = SETTINGS["plans.founder.limit"];
    expect(limit).toMatchObject({ default: 20, scopes: ["global"] });
    expect(limit.schema.safeParse(limit.default).success).toBe(true);
    for (const value of [0, -1, 1.5, "20", (limit.max ?? 0) + 1]) expect(limit.schema.safeParse(value).success).toBe(false);
  });
});

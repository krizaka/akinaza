import { readFileSync } from "node:fs";

import type { PaymentsPort, Price } from "@krizaka/payments";
import { describe, expect, it } from "vitest";

import en from "../messages/en.json";
import fr from "../messages/fr.json";
import { readEnv } from "./env";
import { founderPrice } from "./founder-offer";
import { format } from "./i18n";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const port = (price: () => Promise<Price>) => ({ price }) as unknown as PaymentsPort;
const FOUNDER_PRICE: Price = { amount: 3900, currency: "cad", interval: "month" };

describe("the founder offer on the public page", () => {
  it("is hidden until it is switched on", () => {
    expect(readEnv({}).APP_FOUNDER_OFFER_ENABLED).toBe(false);
    expect(readEnv({ APP_FOUNDER_OFFER_ENABLED: "true" }).APP_FOUNDER_OFFER_ENABLED).toBe(true);
    expect(read("app/[locale]/page.tsx")).toMatch(/APP_FOUNDER_OFFER_ENABLED && <FounderOffer/);
  });
  it("says what it is, in both languages: limited, setup included, and no amount typed in a message", () => {
    for (const t of [en.landing.founder, fr.landing.founder]) {
      expect(JSON.stringify(t)).not.toMatch(/\b\d+ ?\$/);
      expect(t.title).toContain("{price}");
      expect(t.points[0]).toContain("{price}");
      expect(t.points.length).toBe(4);
    }
    expect(en.landing.founder.title).toMatch(/setup included/i);
    expect(fr.landing.founder.title).toMatch(/mise en route incluse/i);
    expect(JSON.stringify(en.landing.founder)).toMatch(/limited/i);
    expect(JSON.stringify(fr.landing.founder)).toMatch(/limitée/i);
  });
});

describe("the price is the processor's, formatted with the locale", () => {
  it("reads the price and formats it in each language", async () => {
    const p = port(async () => FOUNDER_PRICE);
    const enCopy = await founderPrice(p, "en");
    const frCopy = await founderPrice(p, "fr");
    expect(format(en.landing.founder.title, enCopy!)).toBe("Founder offer: $39 a month plus taxes, setup included");
    expect(format(fr.landing.founder.title, frCopy!).replace(/\s/g, " ")).toBe("Offre fondateur : 39 $ par mois plus taxes, mise en route incluse");
  });
  it("follows the processor when the price changes", async () => {
    expect((await founderPrice(port(async () => ({ ...FOUNDER_PRICE, amount: 4900 })), "en"))?.price).toBe("$49");
  });
  it("shows nothing when payments are off or the price cannot be read — never a guess", async () => {
    expect(await founderPrice(null, "en")).toBeNull();
    expect(await founderPrice(port(async () => { throw new Error("down"); }), "fr")).toBeNull();
  });
  it("the catalogue (data for the setup) sells the founder offer at 3900 cents, tax exclusive (lib/pricing.test.ts holds the whole grid)", () => {
    const catalogue = JSON.parse(read("../../payments/catalogue.json"));
    expect(catalogue.plans[0]).toMatchObject({ lookupKey: "akinaza_founder_monthly_cad", amount: 3900, currency: "cad", interval: "month" });
  });
});

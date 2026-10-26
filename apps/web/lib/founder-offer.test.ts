import { readFileSync } from "node:fs";

import { memoryPriceStore, priceCatalogue } from "@krizaka/settings";
import { describe, expect, it } from "vitest";

import en from "../messages/en.json";
import fr from "../messages/fr.json";
import { founderGate } from "./billing";
import { readEnv } from "./env";
import { founderCap, founderEntry, founderOfferCopy, onSale } from "./founder-offer";
import { format } from "./i18n";
import { FOUNDER, PRICES } from "./pricing";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const NOW = new Date("2026-11-01T12:00:00Z");
const ADMIN = { id: null, label: "admin@example.com" };
const fresh = () => priceCatalogue(PRICES, memoryPriceStore());

/** The `accounts` table, for the gate: the accounts that hold a subscription. */
const accounts = (subscribed: number) =>
  (async (text: string, values: unknown[] = []) => {
    if (/count\(\*\)/i.test(text)) return [{ taken: subscribed }];
    return [{ sub: values[0] === "founder" ? "sub_1" : null }];
  }) as never;

describe("the founder offer on the public page", () => {
  it("is hidden until it is switched on", () => {
    expect(readEnv({}).APP_FOUNDER_OFFER_ENABLED).toBe(false);
    expect(readEnv({ APP_FOUNDER_OFFER_ENABLED: "true" }).APP_FOUNDER_OFFER_ENABLED).toBe(true);
    expect(read("app/[locale]/page.tsx")).toMatch(/APP_FOUNDER_OFFER_ENABLED && <FounderOffer/);
  });
  it("says what it is, in both languages: limited, setup included, 0 % on cards, and no amount typed in a message", () => {
    for (const t of [en.landing.founder, fr.landing.founder]) {
      expect(JSON.stringify(t)).not.toMatch(/\b\d+ ?\$/);
      expect(t.title).toContain("{price}");
      expect(t.points[0]).toContain("{price}");
    }
    expect(en.landing.founder.title).toMatch(/setup included/i);
    expect(fr.landing.founder.title).toMatch(/mise en route incluse/i);
    expect(JSON.stringify(en.landing.founder)).toMatch(/limited/i);
    expect(JSON.stringify(fr.landing.founder)).toMatch(/limitée/i);
  });
});

describe("every figure of the offer is the catalogue's, formatted with the locale (akinaza#371)", () => {
  it("reads the founder entry: 39 $ plus taxes, 0 % on cards, 0,5 % by debit capped at 15 $, the first 20 businesses", async () => {
    const entry = await founderEntry(fresh(), NOW);
    const enCopy = founderOfferCopy(entry, "en")!;
    const frCopy = founderOfferCopy(entry, "fr")!;
    expect(format(en.landing.founder.title, enCopy)).toBe("Founder offer: $39 a month plus taxes, setup included");
    expect(format(fr.landing.founder.title, frCopy).replace(/\s/g, " ")).toBe("Offre fondateur : 39 $ par mois plus taxes, mise en route incluse");
    expect(format(fr.landing.founder.points[1]!, frCopy).replace(/\s/g, " ")).toMatch(/^0 % sur les cartes/);
    expect(format(en.landing.founder.points[2]!, enCopy)).toBe("Pre-authorised debit or B2B transfer: 0.5% an order, capped at $15; the funds stay with the payment processor");
    expect(enCopy.limit).toBe(20);
  });
  it("follows the administrator's change from its date, and ends the offer when the administrator makes it internal", async () => {
    const prices = fresh();
    const later = new Date("2026-12-01T00:00:00Z");
    await prices.schedule(ADMIN, FOUNDER, { amountCents: 5000 }, later, NOW);
    expect(founderOfferCopy(await founderEntry(prices, NOW), "en")?.price).toBe("$39");
    expect(founderOfferCopy(await founderEntry(prices, later), "en")?.price).toBe("$50");
    await prices.schedule(ADMIN, FOUNDER, { availability: "internal" }, NOW, NOW);
    const hidden = await founderEntry(prices, NOW);
    expect(onSale(hidden)).toBe(false);
    expect(founderOfferCopy(hidden, "fr")).toBeNull();
  });
});

describe("the founder gate reads the cap from the catalogue (akinaza#371)", () => {
  it("is the founder entry's founderCap: 20 by default, raised by the administrator with no deployment", async () => {
    const prices = fresh();
    const entry = await founderEntry(prices, NOW);
    expect(founderCap(entry)).toBe(20);
    expect(await founderGate(accounts(19), "newcomer", founderCap(entry))).toBe("open");
    expect(await founderGate(accounts(20), "newcomer", founderCap(entry))).toBe("full");
    await prices.schedule(ADMIN, FOUNDER, { limits: { ...entry.limits, founderCap: 30 } }, NOW, NOW);
    const raised = await founderEntry(prices, NOW);
    expect(founderCap(raised)).toBe(30);
    expect(await founderGate(accounts(20), "newcomer", founderCap(raised))).toBe("open");
    expect(await founderGate(accounts(40), "founder", founderCap(raised))).toBe("member");
  });
  it("the checkout, the home and the subscription page read the cap and the price from the catalogue, never a setting or the processor", () => {
    for (const f of ["app/api/billing/checkout/route.ts", "components/home/FounderOffer.tsx", "app/[locale]/(app)/app/(account)/profile/subscription/page.tsx"]) {
      const src = read(f);
      expect(src, f).toMatch(/appPrices\(\)/);
      expect(src, f).toMatch(/founderCap\(entry\)/);
      expect(src, f).not.toMatch(/plans\.founder\.limit|founderLimit/);
    }
  });
  it("the checkout sells only the amount the catalogue shows, and records the version it sold", () => {
    const src = read("app/api/billing/checkout/route.ts");
    expect(src).toMatch(/\.amount !== entry\.amountCents\) throw refuse\(503, "PRICE_NOT_READY"/);
    expect(src).toMatch(/recordOfferedVersion\(query, account\.id, entry\.versionId\)/);
  });
});

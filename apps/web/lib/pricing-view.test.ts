import { readFileSync } from "node:fs";

import { findTypedPrices, memoryPriceStore, priceCatalogue, publicCatalogue } from "@krizaka/settings";
import { describe, expect, it } from "vitest";

import en from "../messages/en.json";
import fr from "../messages/fr.json";
import { FOUNDER, PRICES, SCALE, STARTER } from "./pricing";
import { pricingPlans } from "./pricing-view";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const NOW = new Date("2026-11-01T12:00:00Z");
const ADMIN = { id: null, label: "admin@example.com" };
const view = async (prices = priceCatalogue(PRICES, memoryPriceStore()), locale: "en" | "fr" = "en", founderOnSale = false) => pricingPlans(publicCatalogue(await prices.catalogue(NOW)), locale, { founderOnSale });

describe("the public pricing page reads the catalogue (akinaza#380)", () => {
  it("shows Starter at 45 $ and Pro (the scale entry) at 99 $, with the fees of the catalogue: 0 % on cards, the capped debit fee", async () => {
    const [starter, scale, ...rest] = await view();
    expect(rest).toEqual([]);
    expect([starter!.id, starter!.price, scale!.id, scale!.price]).toEqual(["starter", "$45", "scale", "$99"]);
    expect(starter!.features.find((f) => f.id === "fees")!.vars).toEqual({ cardRate: "0%", debitRate: "0.5%", debitCap: "$15" });
    expect(scale!.features.find((f) => f.id === "fees")!.vars).toEqual({ cardRate: "0%", debitRate: "0.25%", debitCap: "$10" });
    expect((await view(undefined, "fr"))[0]!.price!.replace(/\s/g, " ")).toBe("45 $");
  });

  it("a price changed in the catalogue changes the page", async () => {
    const prices = priceCatalogue(PRICES, memoryPriceStore());
    await prices.schedule(ADMIN, STARTER, { amountCents: 5900 }, NOW, NOW);
    const entry = await prices.entry(STARTER, NOW);
    await prices.schedule(ADMIN, SCALE, { limits: { ...entry.limits, directDebitCapCents: 2000 } }, NOW, NOW);
    const [starter, scale] = await view(prices);
    expect(starter!.price).toBe("$59");
    expect(scale!.features.find((f) => f.id === "fees")!.vars.debitCap).toBe("$20");
  });

  it("a plan in preparation has no figure, an internal one is not shown", async () => {
    const prices = priceCatalogue(PRICES, memoryPriceStore());
    await prices.schedule(ADMIN, SCALE, { availability: "preparing" }, NOW, NOW);
    await prices.schedule(ADMIN, STARTER, { availability: "internal" }, NOW, NOW);
    const plans = await view(prices);
    expect(plans.map((p) => p.id)).toEqual(["scale"]);
    expect(plans[0]!.price).toBeNull();
  });

  it("shows the founder offer only while it is on sale, with its cap read from the catalogue", async () => {
    expect((await view()).map((p) => p.id)).toEqual(["starter", "scale"]);
    const plans = await view(undefined, "en", true);
    expect(plans.map((p) => p.id)).toEqual(["founder", "starter", "scale"]);
    expect(plans[0]).toMatchObject({ price: "$39", limit: 20 });
    const prices = priceCatalogue(PRICES, memoryPriceStore());
    await prices.schedule(ADMIN, FOUNDER, { availability: "internal" }, NOW, NOW);
    expect((await view(prices, "en", true)).map((p) => p.id)).toEqual(["starter", "scale"]);
  });

  it("a feature that is not built is flagged soon, and carries no figure unless it is a stated rate", async () => {
    const plans = await view();
    expect(plans[0]!.features.filter((f) => f.soon).map((f) => f.id)).toEqual(["payments", "fees"]);
    expect(plans[1]!.features.filter((f) => f.soon).map((f) => f.id)).toEqual(["payments", "fees", "contract", "transfers"]);
    for (const f of plans.flatMap((p) => p.features.filter((x) => x.soon && x.id !== "fees"))) {
      expect(f.vars, f.id).toEqual({});
      for (const t of [en, fr]) expect(t.pricing.features[f.id], f.id).not.toMatch(/\d+\s?[%$]|\$\s?\d|\{/);
    }
  });

  it("lists as running only what runs: client payments, their fees, the contract and the transfers are all planned (akinaza#440)", async () => {
    for (const plan of await view()) {
      const running = plan.features.filter((f) => !f.soon).map((f) => f.id);
      for (const planned of ["payments", "fees", "contract", "transfers"] as const) expect(running, `${plan.id} ${planned}`).not.toContain(planned);
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

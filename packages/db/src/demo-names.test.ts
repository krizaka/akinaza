import { describe, expect, it } from "vitest";

import { ALL_DEMO_SHOPS } from "./demo-shops";
import { KRIZAKA, KRIZAKA_SECOND } from "./seed-krizaka";
import { OWNER_STATES } from "./seed-owner-states";
import { SAINT_HENRI } from "./seed-walker";

/**
 * Akinaza serves service businesses only: a restaurant, a café, a bar or a bakery must bill through a sales recording module
 * certified by Revenu Québec (AGENTS § 2). The demo data must never show one as a shop or as a client (krizaka/akinaza#326).
 */
const FOOD_AND_DRINK = /(?<!\p{L})(caf[eé]s?|restaurants?|resto|bars?|bistrots?|bistros?|brasseries?|boulangeries?|bakery|bakeries|p[aâ]tisseries?|pubs?|tavernes?|taverns?)(?!\p{L})/iu;

const demoNames: [string, string][] = [
  ...[KRIZAKA.shop.name, KRIZAKA.shop.legalName, KRIZAKA_SECOND.shop.name, KRIZAKA_SECOND.shop.legalName].map((n): [string, string] => ["seed-krizaka shop", n]),
  ...KRIZAKA.clients.flatMap((c): [string, string][] => [["seed-krizaka client", c.name], ["seed-krizaka client e-mail", c.email]]),
  ...[OWNER_STATES.empty.shop, OWNER_STATES.one.shop].flatMap((x): [string, string][] => [["seed-owner-states shop", x.name], ["seed-owner-states shop", x.legalName]]),
  ["seed-owner-states client", OWNER_STATES.one.client.name],
  ["seed-walker shop", SAINT_HENRI.shop.name],
  ["seed-walker shop", SAINT_HENRI.shop.legalName],
  ...SAINT_HENRI.clients.map((c): [string, string] => ["seed-walker client", c.name]),
  ...ALL_DEMO_SHOPS.flatMap((d): [string, string][] => [["demo-shops shop", d.shop.name], ["demo-shops shop", d.shop.legalName]]),
];

describe("the demo data names no café, restaurant, bar or bakery (service businesses only)", () => {
  it("knows the words it refuses, in French and in English", () => {
    for (const bad of ["Café du Parc inc.", "contact.cafedupark", "Le Bistro", "Brasserie Nord", "Boulangerie Ange", "Sunny Bakery", "Bar Ritz", "Resto Chez Lou"]) {
      expect(FOOD_AND_DRINK.test(bad.replace(/cafedupark/, "cafe du park")), bad).toBe(true);
    }
    for (const fine of ["Studio Lumen inc. (démo)", "Atelier Boréal inc. (démo)", "Barbier Saint-Denis", "Nord Studio Montréal Ltd. (demo)"]) {
      expect(FOOD_AND_DRINK.test(fine), fine).toBe(false);
    }
  });

  it.each(demoNames)("%s « %s »", (_where, name) => {
    expect(FOOD_AND_DRINK.test(name.replace(/^contact\.|@.*$/g, "").replace(/[._-]/g, " ")), name).toBe(false);
    expect(name.toLowerCase()).not.toMatch(/caf[eé]/);
  });
});

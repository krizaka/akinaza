import { readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { retiredAddresses } from "../next.config.mjs";
import { accountRoutes, shopRoutes } from "./routes";

/**
 * One language of addresses in the signed-in space (akinaza#582): the address bar is part of the product, and an English
 * console must not carry French words (`/en/app/<shop>/aujourdhui`, `/boutique`). The segments are English, in both locales;
 * the French ones answer 308 to them (next.config.mjs).
 */
const APP = join(__dirname, "..", "app", "[locale]", "(app)", "app");
const FRENCH = ["aujourdhui", "boutique", "creneau", "creneaux", "factures", "facture", "equipe", "parametres", "agenda-perso"];

function segments(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .flatMap((e) => [e.name, ...segments(join(dir, e.name))]);
}
const words = (path: string) => path.split(/[/?&=]/).filter(Boolean);
const SHOP = "0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d";

describe("no English console path contains a French word (akinaza#582)", () => {
  it("the folders of the signed-in space", () => {
    expect(segments(APP).filter((s) => FRENCH.includes(s.toLowerCase()))).toEqual([]);
  });

  it("every address the routes build, in both languages", () => {
    const r = shopRoutes("en", SHOP);
    const built = [r.root, r.today("2026-10-23", "x"), r.brief, r.clients, r.client("c"), r.invoices, r.invoice("i"), r.invoiceCorrect("i"), r.newInvoice, r.books("2026-10"), r.boutique(), r.boutique("team", "t"), r.team, r.setup, r.addShop, ...Object.values(accountRoutes("en")).filter((v): v is string => typeof v === "string")];
    for (const path of built) for (const locale of ["en", "fr"]) expect(words(path.replace("/en/", `/${locale}/`)).filter((w) => FRENCH.includes(w)), path).toEqual([]);
  });

  it("the English addresses are today and settings", () => {
    const r = shopRoutes("fr", SHOP);
    expect(r.today()).toBe(`/fr/app/${SHOP}/today`);
    expect(r.team).toBe(`/fr/app/${SHOP}/settings/team`);
    expect(r.boutique("page")).toBe(`/fr/app/${SHOP}/settings/page`);
  });

  it("the old French addresses answer 308 to them, with their section and in both languages", () => {
    const sources = (retiredAddresses as { source: string; destination: string; permanent: boolean }[]).filter((r) => /aujourdhui|boutique/.test(r.source));
    expect(sources.every((r) => r.permanent)).toBe(true);
    expect(sources.map((r) => r.destination).sort()).toEqual(["/:locale/app/:shop/settings", "/:locale/app/:shop/settings/:section", "/:locale/app/:shop/today"]);
  });
});

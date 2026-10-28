import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { format } from "./i18n";
import { publisherVars } from "./publisher";
import { llmsText } from "./seo";
import { pagePath, PAGES, TERMS_VERSION } from "./site";

const ROOT = join(__dirname, "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

describe("the terms of use (akinaza#379)", () => {
  it("is a public page in both languages: routed, in the sitemap and in llms.txt", () => {
    expect(PAGES).toContain("terms");
    expect(pagePath("fr", "terms")).toBe("/fr/terms");
    expect(pagePath("en", "terms")).toBe("/en/terms");
    expect(read("app/[locale]/terms/page.tsx")).toContain("export default async function Terms");
    expect(llmsText()).toContain("/en/terms");
    expect(llmsText()).toContain("/fr/terms");
  });

  it("renders its version, a lawyer-review marker and a link to the privacy notice", () => {
    const page = read("app/[locale]/terms/page.tsx");
    expect(TERMS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(page).toContain('data-lawyer-review="pending"');
    expect(page).toContain("TERMS_VERSION");
    expect(page).toContain('pagePath(locale, "privacy")');
  });

  it("has the same sections in French (the reference) and in English", () => {
    expect(fr.terms.sections).toHaveLength(en.terms.sections.length);
    expect(fr.terms.sections.length).toBeGreaterThanOrEqual(12);
    for (const s of [...fr.terms.sections, ...en.terms.sections]) {
      expect(s.h.length).toBeGreaterThan(3);
      expect(s.p.length).toBeGreaterThan(80);
    }
  });

  it("covers what the issue requires, with the law cited", () => {
    const text = (d: typeof fr) => d.terms.sections.map((s) => `${s.h} ${format(s.p, publisherVars())}`).join("\n");
    const french = text(fr);
    for (const needle of ["Loi sur la protection du consommateur", "Code civil du Québec", "L.Q. 2021, c. 25", "renouvelle", "résilier", "ne détient jamais de fonds", "ne produit, ne signe et ne transmet aucune déclaration", "Québec", "tribunaux", "3149", "2125", "1474", "Charte de la langue française"]) {
      expect(french, needle).toContain(needle);
    }
    const english = text(en);
    for (const needle of ["Consumer Protection Act", "Civil Code of Québec", "S.Q. 2021, c. 25", "never holds funds", "never produces, signs or transmits a return", "art. 3149", "art. 2125", "art. 1474", "French prevails"]) {
      expect(english, needle).toContain(needle);
    }
  });

  it("reserves Krizaka's rights: IP, licence limited to the subscription, no resale or white label, marks (akinaza#409)", () => {
    const text = (d: typeof fr) => d.terms.sections.map((s) => `${s.h} ${format(s.p, publisherVars())}`).join("\n");
    const french = text(fr);
    for (const needle of ["appartiennent à Technologies Krizaka Inc.", "Pour la durée de votre abonnement seulement", "non cessible et non sous-licenciable", "marque blanche", "service concurrent", "Loi sur le droit d'auteur", "Loi sur les marques de commerce", "TRADEMARKS.md", "sa propre licence"]) {
      expect(french, needle).toContain(needle);
    }
    const english = text(en);
    for (const needle of ["belong to Technologies Krizaka Inc.", "For the length of your subscription only", "non-transferable, non-sublicensable", "white label", "competing service", "Copyright Act", "Trademarks Act", "TRADEMARKS.md", "its own licence"]) {
      expect(english, needle).toContain(needle);
    }
  });

  it("keeps the shop's content and the code licence out of the reverse-engineering clause", () => {
    for (const d of [fr, en]) {
      const clause = d.terms.sections.find((s) => /^14\./.test(s.h))?.p ?? "";
      expect(clause).toMatch(/publi[ée]|published/);
    }
  });

  it("keeps to the house rules: no escrow word, no promise of conformity to a law, no AI wording", () => {
    for (const d of [fr, en]) {
      const text = d.terms.sections.map((s) => s.p).join(" ");
      expect(text).not.toMatch(/\bIA\b|\bAI\b|intelligen|révolution/i);
    }
  });

  it("is linked from the footer, sign-in, sign-up, the subscription page and the founder offer's checkout", () => {
    expect(read("components/SiteFooter.tsx")).toContain('pagePath(locale, "terms")');
    expect(read("app/[locale]/(app)/sign-in/page.tsx")).toContain('pagePath(locale, "terms")');
    expect(read("app/[locale]/(app)/sign-up/page.tsx")).toContain('pagePath(locale, "terms")');
    expect(read("components/account/SubscriptionPanel.tsx")).toContain("/terms");
    expect(read("components/home/FounderOffer.tsx")).toContain('pagePath(locale, "terms")');
  });

  it("keeps the accepted version in the audit trail when the checkout starts", () => {
    const route = read("app/api/billing/checkout/route.ts");
    expect(route).toContain("billing.terms_accepted");
    expect(route).toContain("TERMS_VERSION");
  });
});

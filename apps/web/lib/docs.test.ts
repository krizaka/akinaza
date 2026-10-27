import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import en from "../messages/en.json";
import fr from "../messages/fr.json";
import { DOC_IDS, docHref, HELP_AREAS, helpHref, isDocId, neighbours } from "./docs";
import { llmsText } from "./seo";
import { pagePath,PAGES } from "./site";

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("the owner's guide (akinaza#382)", () => {
  it("is five pages at most, one job each, in both languages with the same sections", () => {
    expect(DOC_IDS).toEqual(["shop", "bookings", "invoices", "books", "data"]);
    expect(DOC_IDS.length).toBeLessThanOrEqual(5);
    for (const id of DOC_IDS) {
      const [e, f] = [en.docs.pages[id], fr.docs.pages[id]];
      expect(f.sections.map((s) => s.id), id).toEqual(e.sections.map((s) => s.id));
      for (const page of [e, f]) {
        expect(page.title.length).toBeGreaterThan(3);
        for (const s of page.sections) expect(s.p.join("").length + s.items.length, `${id}/${s.id}`).toBeGreaterThan(20);
      }
    }
  });

  it("every page builds in both languages: it has a route, a sitemap entry and a line in llms.txt", () => {
    expect(existsSync(join(ROOT, "app/[locale]/docs/page.tsx"))).toBe(true);
    const route = read("app/[locale]/docs/[page]/page.tsx");
    expect(route).toContain("generateStaticParams");
    expect(route).toContain("dynamicParams = false");
    for (const id of DOC_IDS) {
      expect(PAGES).toContain(`docs/${id}`);
      expect(docHref("fr", id)).toBe(`/fr/docs/${id}`);
      expect(isDocId(id)).toBe(true);
      expect(llmsText()).toContain(`/en/docs/${id}`);
    }
    expect(PAGES).toContain("docs");
    expect(isDocId("nope")).toBe(false);
    expect(pagePath("en", "docs")).toBe("/en/docs");
  });

  it("is in the bar (a flat link) and the footer", () => {
    expect(read("components/SiteChrome.tsx")).toContain('docs: pagePath(locale, "docs")');
    expect(read("components/SiteFooter.tsx")).toContain('pagePath(locale, "docs")');
  });

  it("every in-app « Help » link lands on its page", () => {
    for (const [area, id] of Object.entries(HELP_AREAS)) {
      expect(DOC_IDS, area).toContain(id);
      for (const locale of ["en", "fr"] as const) expect(helpHref(locale, area as keyof typeof HELP_AREAS)).toBe(`/${locale}/docs/${id}`);
    }
  });

  it("reads in order, from the first page to the last", () => {
    expect(neighbours("shop")).toEqual({ previous: null, next: "bookings" });
    expect(neighbours("data")).toEqual({ previous: "books", next: null });
  });

  it("says only what is true: Akinaza prepares and never files, no escrow, no AI wording, no figure typed", () => {
    for (const d of [en.docs, fr.docs]) {
      const text = JSON.stringify(d);
      expect(text).not.toMatch(/escrow|séquestre|\bAI\b|\bIA\b|intellig|restaurant/i);
      expect(text).not.toMatch(/\d+ ?\$|\$ ?\d/);
    }
    expect(en.docs.pages.books.sections.find((s) => s.id === "file")!.p.join(" ")).toMatch(/never files a return/);
    expect(fr.docs.pages.books.sections.find((s) => s.id === "file")!.p.join(" ")).toMatch(/ne produit jamais de déclaration/);
  });

  it("the guide's words about its own app match the app's words (the sections it names exist)", () => {
    const c = en.console;
    expect(en.docs.pages.invoices.sections.find((s) => s.id === "correct")!.p.join(" ")).toContain("credit note");
    expect(c.invoices.actions.correct).toBe("Correct");
    expect(c.books.lines["101"].label).toBeTruthy();
    expect(c.boutique.sections.languages).toBe("Languages");
    expect(c.boutique.sections.invoices).toBe("Invoice e-mails");
    expect(c.account.data.export).toBe("Export");
  });
});

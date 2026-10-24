import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

const ROOT = join(__dirname, "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const APP = "app/[locale]/(app)/app";
const SHOP = `${APP}/[shop]`;

describe("the owner's app keeps only what the job needs (krizaka/akinaza#161)", () => {
  it("has the places of a shop in the bar (what each role sees is lib/app-nav); no connections", () => {
    const layout = read("components/app/SpaceChrome.tsx");
    expect(layout).toContain("placesFor(member.role)");
    expect(layout).not.toContain("connections");
    expect(existsSync(join(ROOT, `${APP}/connections/page.tsx`))).toBe(false);
    expect(read("next.config.mjs")).toContain('source: "/:locale(en|fr)/app/connections"');
  });

  it("invoices: the list is the screen; the one primary action, « Nouvelle facture », is the frame's (docs/ux/2026-10-full-review.md A3) and leads to a route of its own", () => {
    const list = read(`${SHOP}/invoices/page.tsx`);
    expect(list).not.toContain("InvoiceForm");
    expect(list).not.toContain('variant="primary"');
    expect(read("components/app/SpaceChrome.tsx")).toContain("newInvoiceHref");
    expect(existsSync(join(ROOT, `${SHOP}/invoices/new/page.tsx`))).toBe(true);
  });

  it("the invoice form asks for a client, services and an optional line: no language, date or terms fields, no helper texts", () => {
    const form = read("components/app/InvoiceForm.tsx");
    for (const gone of ['name="language"', 'name="issuedOn"', 'name="terms"', "quantityHint", "termsHint", "invoices.new.taxes"]) expect(form, gone).not.toContain(gone);
    for (const m of [en, fr]) for (const key of ["language", "languages", "issuedOn", "terms", "termsDefault", "termsOnReceipt", "termsNet", "termsHint", "quantityHint", "taxes", "day", "month", "year"]) expect(m.console.invoices.new, key).not.toHaveProperty(key);
  });

  it("books: the figures and their lines, no banner repeating the footnote, no pager for seven lines, no per-line helper text", () => {
    const page = read(`${SHOP}/books/page.tsx`);
    expect(page).not.toContain("<Alert");
    expect(read("components/app/BooksLines.tsx")).not.toContain(".how");
    for (const m of [en, fr]) {
      expect(m.console.books).not.toHaveProperty("notFiled");
      expect(m.console.books.footnote).toMatch(/Revenu Québec/);
      for (const line of Object.values(m.console.books.lines)) expect(line).not.toHaveProperty("how");
      expect(m.console).not.toHaveProperty("connections");
    }
  });

  it("the period of the books and the day of the schedule live in the URL", () => {
    expect(read("lib/routes.ts")).toContain("period");
    expect(read("lib/routes.ts")).toContain("day");
    expect(read(`${SHOP}/books/page.tsx`)).toContain("books(p.id)");
  });

  it("the shop's pages ask the role table, never the owner: no page reads shopOfOwner", () => {
    const pages = ["(account)/page.tsx", "(account)/layout.tsx", "(account)/profile/page.tsx", "[shop]/layout.tsx", "[shop]/aujourdhui/page.tsx", "[shop]/clients/page.tsx", "[shop]/clients/[id]/page.tsx", "[shop]/invoices/page.tsx", "[shop]/invoices/[id]/page.tsx", "[shop]/invoices/new/page.tsx", "[shop]/books/page.tsx", "[shop]/shop/page.tsx", "[shop]/team/page.tsx"];
    for (const page of pages) expect(read(`${APP}/${page}`), page).not.toContain("shopOfOwner");
  });
});

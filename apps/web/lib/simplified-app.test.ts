import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

const ROOT = join(__dirname, "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const APP = "app/[locale]/(app)/app";

describe("the owner's app keeps only what the job needs (krizaka/akinaza#161)", () => {
  it("has the places of a shop in the bar (what each role sees is lib/app-nav); no connections", () => {
    const layout = read(`${APP}/layout.tsx`);
    expect(layout).toContain("placesFor(member.role)");
    expect(layout).not.toContain("connections");
    expect(existsSync(join(ROOT, `${APP}/connections/page.tsx`))).toBe(false);
    expect(read("next.config.mjs")).toContain('source: "/:locale(en|fr)/app/connections"');
  });

  it("invoices: the list is the screen, with one primary action to a route of its own for the form", () => {
    const list = read(`${APP}/invoices/page.tsx`);
    expect(list).not.toContain("InvoiceForm");
    expect((list.match(/variant="primary"/g) ?? []).length).toBe(1);
    expect(list).toContain("/app/invoices/new");
    expect(existsSync(join(ROOT, `${APP}/invoices/new/page.tsx`))).toBe(true);
  });

  it("the invoice form asks for a client, services and an optional line: no language, date or terms fields, no helper texts", () => {
    const form = read("components/app/InvoiceForm.tsx");
    for (const gone of ['name="language"', 'name="issuedOn"', 'name="terms"', "quantityHint", "termsHint", "invoices.new.taxes"]) expect(form, gone).not.toContain(gone);
    for (const m of [en, fr]) for (const key of ["language", "languages", "issuedOn", "terms", "termsDefault", "termsOnReceipt", "termsNet", "termsHint", "quantityHint", "taxes", "day", "month", "year"]) expect(m.console.invoices.new, key).not.toHaveProperty(key);
  });

  it("books: the figures and their lines, no banner repeating the footnote, no pager for seven lines, no per-line helper text", () => {
    const page = read(`${APP}/books/page.tsx`);
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
    expect(read(`${APP}/books/page.tsx`)).toContain("?period=");
    expect(read(`${APP}/page.tsx`)).toContain("?day=");
  });

  it("the shop's pages ask the role table, never the owner: no page reads shopOfOwner", () => {
    const pages = ["page.tsx", "layout.tsx", "clients/page.tsx", "clients/[id]/page.tsx", "invoices/page.tsx", "invoices/[id]/page.tsx", "invoices/new/page.tsx", "books/page.tsx", "shop/page.tsx", "profile/page.tsx", "team/page.tsx"];
    for (const page of pages) expect(read(`${APP}/${page}`), page).not.toContain("shopOfOwner");
  });
});

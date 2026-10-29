import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./record-krizaka-first-client.mjs", import.meta.url), "utf8");

describe("record-krizaka-first-client (the studio's walkthroughs)", () => {
  it("has the four clips, each beat said in English and in French", () => {
    for (const clip of ["onboarding", "invoice", "books", "return"]) expect(source).toContain(`await clip("${clip}"`);
    const beats = [...source.matchAll(/take\.beat\("(\w+)"\)/g)].map((m) => m[1]);
    for (const beat of ["open", "services", "today", "clients", "form", "issued", "document", "list", "sources", "top", "notFiled"]) {
      expect(beats).toContain(beat);
      expect(source).toMatch(new RegExp(`${beat}: \\{\\n      en: "[^"]{10,}",\\n      fr: "[^"]{10,}"`));
    }
  });

  it("says the data is demo data and that Akinaza prepares, never files", () => {
    expect(source).toMatch(/demo data/);
    expect(source).toMatch(/never files|never filed|jamais produite/);
    expect(source).not.toMatch(/transmit|send it to Revenu Québec/i);
  });

  it("shows the taxes to the cent it asserts (the template's rounding: 349.125 rounds up)", () => {
    expect(source).toContain("194.51"); // 7.5 h of consulting + a workshop: 1 950.00 × 9.975 % = 194.5125
    expect(source).toContain("162,09"); // 7,5 h of development + the support plan: 1 625,00 × 9.975 % = 162.09375
  });

  it("records the fractional hours, the payment terms and the vocabulary the clip is about", () => {
    expect(source).toContain('"7.5"');
    expect(source).toContain('"7,5"');
    expect(source).toMatch(/payment terms and the due date/);
    expect(source).toMatch(/business type decides the vocabulary/);
    expect(source).toContain("https://www.akinaza.com");
  });

  it("keeps the credentials in the environment, never in the file or in the output", () => {
    expect(source).toMatch(/need\("E2E_PASSWORD"\)/);
    expect(source).not.toMatch(/password:\s*["'`][^"'`]{6,}["'`]/i);
    expect(source).not.toMatch(/console\.log\([^)]*password/i);
  });

  it("opens the invoice form where it is (the list has a « New invoice » button since the page split), not on the list", () => {
    const invoice = source.slice(source.indexOf('await clip("invoice"'), source.indexOf('await clip("books"'));
    expect(invoice).toContain('go("app/invoices/new")');
    expect(invoice).not.toMatch(/go\("app\/invoices"\)/);
  });

  it("only visits pages that exist (a stale path made the 2026-10-29 run fail at its first label)", () => {
    const pages = [...source.matchAll(/go\(`?"?(app[^"`?$]*)/g)].map((m) => m[1].replace(/\/$/, ""));
    expect(pages.length).toBeGreaterThan(3);
    for (const page of pages.filter((p) => p !== "app")) {
      const dir = page.slice("app/".length);
      const file = new URL(`../apps/web/app/[locale]/(app)/app/[shop]/${dir}/page.tsx`, import.meta.url);
      expect(existsSync(file), `${page} has no page`).toBe(true);
    }
  });

  it("reaches the console under the shop's id and leaves the invoice's language to the client's file", () => {
    expect(source).toMatch(/\[0-9a-f-\]\{36\}/);
    expect(source).not.toMatch(/Language of the invoice/);
  });

  it("follows the issued invoice to its page instead of looking for an « Open » link on the list", () => {
    expect(source).toMatch(/waitForURL\(\/\\\/invoices\\\/\[0-9a-f-\]\{36\}\//);
    expect(source).not.toMatch(/name: T\.open/);
  });

  it("scrolls the invoice list by its table (the page has no level-2 heading)", () => {
    expect(source).not.toMatch(/getByRole\("heading", \{ level: 2 \}\)\.last\(\)/);
  });
});

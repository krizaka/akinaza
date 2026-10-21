import { readFileSync } from "node:fs";

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
});

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./record-krizaka-first-client.mjs", import.meta.url), "utf8");

describe("record-krizaka-first-client (the studio's walkthroughs)", () => {
  it("has the four clips, each beat said in English and in French", () => {
    for (const clip of ["onboarding", "invoice", "books", "return"]) expect(source).toContain(`await clip("${clip}"`);
    const beats = [...source.matchAll(/take\.beat\("(\w+)"\)/g)].map((m) => m[1]);
    for (const beat of ["open", "services", "clients", "form", "issued", "document", "list", "sources", "top", "notFiled"]) {
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
    expect(source).toContain("203.49");
    expect(source).toContain("199,50");
  });

  it("keeps the credentials in the environment, never in the file or in the output", () => {
    expect(source).toMatch(/need\("E2E_PASSWORD"\)/);
    expect(source).not.toMatch(/password:\s*["'`][^"'`]{6,}["'`]/i);
    expect(source).not.toMatch(/console\.log\([^)]*password/i);
  });
});

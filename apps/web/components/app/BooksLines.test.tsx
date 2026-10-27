import { describe, expect, it } from "vitest";

import { renderIn } from "@/lib/test-i18n";

import { BooksLines } from "./BooksLines";

const line = (n: number) => ({ line: "103", amountCents: 225, computed: false, sources: Array.from({ length: n }, (_, i) => ({ kind: "invoice" as const, id: `i-${i}`, label: `F-0000${i}`, amountCents: 225 })) });

describe("the lines of the return say how many documents are behind a figure", () => {
  it("never says « 1 documents » (EN and FR)", () => {
    expect(renderIn("en", "professional", <BooksLines lines={[line(1)]} />)).toContain("1 document behind this figure");
    expect(renderIn("fr", "professional", <BooksLines lines={[line(1)]} />)).toContain("1 document derrière ce chiffre");
    expect(renderIn("en", "professional", <BooksLines lines={[line(1)]} />)).not.toContain("1 documents");
  });

  it("counts several", () => {
    expect(renderIn("en", "professional", <BooksLines lines={[line(3)]} />)).toContain("3 documents behind this figure");
    expect(renderIn("fr", "professional", <BooksLines lines={[line(3)]} />)).toContain("3 documents derrière ce chiffre");
  });
});

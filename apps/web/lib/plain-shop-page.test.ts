import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

const read = (path: string) => readFileSync(join(__dirname, "..", path), "utf8");

/** The plain product surface (krizaka/akinaza#161, #142): no mono uppercase eyebrow above a heading on the shop page, its journey or the offer. */
describe("the public shop page and its booking journey carry no eyebrow", () => {
  const files = [
    "components/shop/Storefront.tsx",
    "components/journey/JourneyFrame.tsx",
    "app/[locale]/s/[slug]/(public)/service/[id]/page.tsx",
    "app/[locale]/s/[slug]/(public)/service/[id]/creneau/page.tsx",
    "app/[locale]/s/[slug]/service/[id]/confirmation/page.tsx",
    "components/home/FounderOffer.tsx",
  ];
  for (const file of files) it(`${file}`, () => expect(read(file)).not.toMatch(/eyebrow/i));

  it("has no unused eyebrow messages left", () => {
    expect((en.landing.founder as Record<string, unknown>).eyebrow).toBeUndefined();
    expect((fr.landing.founder as Record<string, unknown>).eyebrow).toBeUndefined();
    expect((en.console.shopPage as Record<string, unknown>).by).toBeUndefined();
    expect((fr.console.shopPage as Record<string, unknown>).by).toBeUndefined();
  });
});

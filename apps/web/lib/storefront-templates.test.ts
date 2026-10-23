import { SHOP_TYPES, TEMPLATES } from "@akinaza/core";
import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

describe("the templates speak both languages (#261)", () => {
  it.each([["en", en], ["fr", fr]] as const)("%s: every template has a name and an intention, and no text lives in the template itself", (_l, m) => {
    const texts = m.console.templates as Record<string, { name: string; intent: string }>;
    for (const t of TEMPLATES) expect(texts[t.id], t.id).toMatchObject({ name: expect.any(String), intent: expect.any(String) });
    expect(Object.keys(texts).sort()).toEqual(TEMPLATES.map((t) => t.id).sort());
    expect(JSON.stringify(texts)).not.toMatch(/\bIA\b|\bAI\b/);
  });

  it("the catalogue holds no text at all (names and intents are messages keyed by id)", () => {
    expect(JSON.stringify(TEMPLATES)).not.toMatch(/name|intent|label/i);
    expect(SHOP_TYPES.every((type) => TEMPLATES.some((t) => t.shopTypes.includes(type)))).toBe(true);
  });
});

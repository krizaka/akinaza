import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// Product first, Orazaka as the engine (krizaka-com AGENTS.md section 2.1): on Akinaza's landing the shop is the
// subject of the hero, the tour steps and the outcomes. Orazaka is named once, honestly, in the trust section.
const messages = (locale: string) => JSON.parse(readFileSync(path.join(import.meta.dirname, "..", "messages", `${locale}.json`), "utf8"));
const texts = (node: unknown): string[] => (typeof node === "string" ? [node] : node && typeof node === "object" ? Object.values(node).flatMap(texts) : []);

describe.each(["en", "fr"])("product first (%s)", (locale) => {
  const landing = messages(locale).landing;
  it("does not name Orazaka in the hero, the tour steps, the outcomes or the how", () => {
    for (const t of texts([landing.eyebrow, landing.title, landing.lead, landing.tour, landing.outcomes, landing.how, landing.closing])) expect(t, t).not.toMatch(/orazaka/i);
  });
  it("names the engine once, in the trust section, and says it is planned", () => {
    expect(texts(landing.trust).filter((t) => /orazaka/i.test(t))).toHaveLength(1);
  });
});

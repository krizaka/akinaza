import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { PlannedFeatures } from "./PlannedFeatures";

describe("what is planned on the pricing page (akinaza#440)", () => {
  const html = renderToStaticMarkup(<PlannedFeatures title={en.pricing.plannedTitle} soon={en.pricing.soon} items={["Your clients' payments", "The signed order contract"]} />);

  it("wears a Soon chip on every line and no tick", () => {
    expect(html.match(/data-soon/g)).toHaveLength(2);
    expect(html).toContain(">Soon<");
    expect(html).not.toMatch(/<svg|M20 6 9 17l-5-5/);
  });

  it("is a labelled region of its own, apart from the list of what runs", () => {
    expect(html).toContain(`aria-label="${en.pricing.plannedTitle}"`);
  });

  it("renders nothing when everything runs", () => {
    expect(renderToStaticMarkup(<PlannedFeatures title="t" soon="s" items={[]} />)).toBe("");
  });

  it("says it in both languages", () => {
    expect([en.pricing.soon, fr.pricing.soon, en.pricing.plannedTitle, fr.pricing.plannedTitle]).toEqual(["Soon", "Bientôt", "Coming soon", "À venir"]);
  });

  it("the page puts only running features in the tick list, planned ones in this block, and one primary button", () => {
    const page = readFileSync(new URL("../../app/[locale]/pricing/page.tsx", import.meta.url), "utf8");
    expect(page).toContain("plan.features.filter((f) => !f.soon)");
    expect(page).toContain("<PlannedFeatures");
    expect(page).toContain('variant={featured ? "primary" : "secondary"}');
    expect(page).not.toContain("(${d.soon})");
  });
});

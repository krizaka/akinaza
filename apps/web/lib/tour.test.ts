import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { SCREENS } from "./landing";
import { MEDIA_CDN, screenStill } from "./tour";

describe("the home's screens", () => {
  it("are hashed, immutable stills of the Krizaka media CDN under site/products/akinaza/tour/, one per language", () => {
    for (const locale of ["en", "fr"] as const) {
      for (const { id } of SCREENS) {
        const base = `${MEDIA_CDN}/site/products/akinaza/tour/phone-${id}-${locale}.`;
        expect(screenStill(id, locale).startsWith(base)).toBe(true);
        expect(screenStill(id, locale).slice(base.length)).toMatch(/^[0-9a-f]{10}\.jpg$/);
      }
    }
  });

  it("are allowed by the page's CSP: the media host, for images", () => {
    const config = readFileSync(new URL("../next.config.mjs", import.meta.url), "utf8");
    expect(config).toContain(`"img-src 'self' data: blob: ${MEDIA_CDN}"`);
  });
});

describe("the retired changelog", () => {
  it("answers 308 to the home in both languages, feed included, and so does the retired connections page", () => {
    const config = readFileSync(new URL("../next.config.mjs", import.meta.url), "utf8");
    expect(config).toContain('source: "/:locale(en|fr)/changelog"');
    expect(config).toContain('source: "/:locale(en|fr)/changelog/feed.xml"');
    expect(config.match(/permanent: true/g)).toHaveLength(3);
  });
});

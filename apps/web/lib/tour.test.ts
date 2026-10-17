import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { MEDIA_CDN, TOUR, tourStill } from "./tour";

describe("the landing's tour", () => {
  it("is the dog walker's real journey on dev.akinaza.com, in five steps: the shop, the booking, the day, the report, the client", () => {
    expect(TOUR.steps).toEqual(["shop", "book", "day", "report", "client"]);
  });

  it("is made of hashed, immutable stills of the Krizaka media CDN under site/products/akinaza/tour/", () => {
    for (const step of TOUR.steps) {
      const base = `${MEDIA_CDN}/site/products/akinaza/tour/phone-${step}.`;
      expect(tourStill(step).startsWith(base)).toBe(true);
      expect(tourStill(step).slice(base.length)).toMatch(/^[0-9a-f]{10}\.jpg$/);
    }
  });

  it("keeps the request ids of the run it shows (the booking and the report sent): the proof it is real", () => {
    for (const id of Object.values(TOUR.requests)) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("is allowed by the page's CSP — the media host, for images", () => {
    const config = readFileSync(new URL("../next.config.mjs", import.meta.url), "utf8");
    expect(config).toContain(`"img-src 'self' data: blob: ${MEDIA_CDN}"`);
  });
});

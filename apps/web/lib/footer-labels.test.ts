import { describe, expect, it } from "vitest";

import { productFooterLabels } from "./footer-labels";

/** The footer is a client component: whatever it is given is written into every page's payload. Product mode needs only the link-back words. */
describe("the product footer ships only its link-back words", () => {
  for (const locale of ["en", "fr"] as const) {
    it(`${locale}: signature, place, version and language, none of the family's one-liners, groups or statuses`, () => {
      const labels = productFooterLabels(locale);
      expect(Object.keys(labels).sort()).toEqual(["current", "descriptions", "family", "groups", "lang", "place", "signature", "status", "version"]);
      expect(labels.signature.product).toBeTruthy();
      expect(labels.descriptions).toEqual({});
      expect(labels.groups).toEqual({});
      expect(labels.status).toEqual({});
      const wire = JSON.stringify(labels).toLowerCase();
      for (const word of ["souverain", "sovereign", "orazaka", "orochia", "yomizaka", "yasakia", "kachizaka"]) expect(wire, word).not.toContain(word);
    });
  }
});

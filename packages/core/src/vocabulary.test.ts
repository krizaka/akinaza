import { describe, expect, it } from "vitest";

import { BUSINESS_TYPES, businessTypeSchema, VOCABULARY, vocabularyOf } from "./vocabulary";

describe("business types", () => {
  it("names the two vocabularies", () => {
    expect([...BUSINESS_TYPES]).toEqual(["professional", "pets"]);
    expect(businessTypeSchema.safeParse("pets").success).toBe(true);
    expect(businessTypeSchema.safeParse("dogs").success).toBe(false);
    for (const food of ["restaurant", "cafe", "bakery", "bar"]) expect(businessTypeSchema.safeParse(food).success).toBe(false);
  });

  it("a pet-care shop books for a dependant and reports on the visit; a studio does neither", () => {
    expect(VOCABULARY.pets).toEqual({ dependants: true, visitReports: true });
    expect(VOCABULARY.professional).toEqual({ dependants: false, visitReports: false });
  });

  it("reads an unknown stored value as the neutral vocabulary, never as the dog walker's", () => {
    expect(vocabularyOf("whatever")).toBe(VOCABULARY.professional);
    expect(vocabularyOf("pets")).toBe(VOCABULARY.pets);
  });
});

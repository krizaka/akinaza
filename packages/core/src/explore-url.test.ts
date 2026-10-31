import { describe, expect, it } from "vitest";

import { exploreQuerySchema, parseExploreParams } from "./explore-query";
import { clearExplore, EXPLORE_NO_FILTERS, type ExploreUrlState, exploreChips, exploreRequest, hasExploreFilters, withoutChip } from "./explore-url";

const state = (over: Partial<ExploreUrlState>): ExploreUrlState => ({ ...EXPLORE_NO_FILTERS, ...over });

describe("exploreRequest (the endpoint's query string for a URL state)", () => {
  it("is empty without a filter, so every visitor shares one cached answer", () => {
    expect(exploreRequest(EXPLORE_NO_FILTERS)).toBe("");
  });

  it("writes every group once, in a fixed order, and the endpoint's own parser reads it back", () => {
    const s = state({ q: " coif ", kinds: ["salon", "boutique"], open: "week", near: [-73.581234567, 45.481234567], within: 3 });
    const qs = exploreRequest(s);
    expect(qs).toBe("q=coif&kind=salon%2Cboutique&open=week&near=-73.58123%2C45.48123&within=3");
    const parsed = parseExploreParams(new URLSearchParams(qs));
    expect(parsed).toMatchObject({ q: "coif", kinds: ["salon", "boutique"], open: "week", near: [-73.58123, 45.48123], within: 3 });
    expect(exploreQuerySchema.safeParse(parsed).success).toBe(true);
  });

  it("holds back what the endpoint would refuse: a one-letter text, a radius without a position", () => {
    expect(exploreRequest(state({ q: "c" }))).toBe("");
    expect(exploreRequest(state({ within: 10 }))).toBe("");
  });

  it("gives the same string whatever the order the kinds were chosen in (one cache key)", () => {
    expect(exploreRequest(state({ kinds: ["other", "salon"] }))).toBe(exploreRequest(state({ kinds: ["salon", "other"] })));
  });
});

describe("chips, removal and « clear all »", () => {
  const full = state({ q: "coif", kinds: ["salon", "services"], open: "free-today", near: [-73.58, 45.48], within: 3 });

  it("one chip per text, per kind, for the opening, the position and the radius; no chip for what is not on", () => {
    expect(exploreChips(full).map((c) => `${c.group}:${c.value}`)).toEqual(["q:coif", "kind:salon", "kind:services", "open:free-today", "near:here", "within:3"]);
    expect(exploreChips(EXPLORE_NO_FILTERS)).toEqual([]);
    expect(exploreChips(state({ q: "a" }))).toEqual([]);
  });

  it("removes only the chip asked; removing the position takes the radius with it", () => {
    const chip = (group: string, value: string) => exploreChips(full).find((c) => c.group === group && c.value === value)!;
    expect(withoutChip(full, chip("kind", "salon")).kinds).toEqual(["services"]);
    expect(withoutChip(full, chip("q", "coif")).q).toBe("");
    expect(withoutChip(full, chip("open", "free-today")).open).toBeNull();
    const away = withoutChip(full, chip("near", "here"));
    expect(away.near).toBeNull();
    expect(away.within).toBeNull();
    expect(withoutChip(full, chip("within", "3")).near).toEqual([-73.58, 45.48]);
  });

  it("clear all empties every group, and says whether anything is on", () => {
    expect(hasExploreFilters(full)).toBe(true);
    expect(clearExplore()).toEqual(EXPLORE_NO_FILTERS);
    expect(hasExploreFilters(clearExplore())).toBe(false);
  });
});

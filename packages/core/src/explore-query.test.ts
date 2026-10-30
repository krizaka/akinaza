import { describe, expect, it } from "vitest";

import { EXPLORE_MAX_LIMIT, exploreQuerySchema, parseExploreParams, searchTokens } from "./explore-query";

const parse = (qs: string) => parseExploreParams(new URLSearchParams(qs));

describe("the Explorer query (one schema for the URL, the request and the cache key)", () => {
  it("is every shop by name when there is no parameter", () => {
    expect(parse("")).toEqual({ limit: EXPLORE_MAX_LIMIT, offset: 0 });
  });

  it("reads every filter from the query string", () => {
    expect(parse("q=coif&kind=salon,boutique&open=week&near=-73.58,45.48&within=3&bbox=-74,45,-73,46&limit=30&offset=30")).toEqual({
      q: "coif", kinds: ["salon", "boutique"], open: "week", near: [-73.58, 45.48], within: 3, bbox: [-74, 45, -73, 46], limit: 30, offset: 30,
    });
  });

  it.each([
    ["an unknown key", "page=2"],
    ["an unknown kind", "kind=bank"],
    ["an unknown opening", "open=always"],
    ["a one-letter search", "q=a"],
    ["a radius that is not offered", "near=-73,45&within=7"],
    ["a radius without a position", "within=3"],
    ["a latitude out of range", "near=-73,95"],
    ["a position missing a part", "near=-73"],
    ["an upside-down box", "bbox=-73,46,-74,45"],
    ["a page too big", "limit=500"],
    ["a negative offset", "offset=-1"],
  ])("refuses %s", (_what, qs) => {
    expect(() => parse(qs)).toThrow();
  });

  it("refuses a key typed twice as the same filter only once (the last wins, nothing is merged)", () => {
    expect(parse("open=now&open=week").open).toBe("now");
    expect(exploreQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
  });

  it("reduces a search to letters and digits without accents, so no operator or quote reaches the index", () => {
    expect(searchTokens("Café  « Cèdre » & 'Ciseaux'; DROP TABLE shops --")).toEqual(["cafe", "cedre", "ciseaux", "drop", "table", "shops"]);
    expect(searchTokens("!!! ???")).toEqual([]);
    expect(searchTokens("a b c d e f g h i j k")).toHaveLength(8);
  });
});

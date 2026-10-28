import { describe, expect, it } from "vitest";

import { mapProblems } from "./check-maps.mjs";

describe("no empty map (akinaza#488)", () => {
  it("refuses a map box of 0 px, the bug of the shop page", () => {
    expect(mapProblems("/fr/s/x (dark)", { width: 1148, height: 0, canvasWidth: 1148, canvasHeight: 300 })).toEqual(["/fr/s/x (dark): the map box is 1148x0 px (empty)"]);
  });
  it("refuses a page whose map is missing, or has no canvas", () => {
    expect(mapProblems("/p", null)).toHaveLength(1);
    expect(mapProblems("/p", { width: 800, height: 450, canvasWidth: 0, canvasHeight: 0 })).toEqual(["/p: the map has no canvas"]);
  });
  it("accepts a map with a box and a canvas", () => {
    expect(mapProblems("/p", { width: 1148, height: 646, canvasWidth: 1148, canvasHeight: 646 })).toEqual([]);
  });
});

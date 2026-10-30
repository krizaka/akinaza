import { describe, expect, it } from "vitest";

import { moveReel, posterTime } from "./reel-order";

describe("the owner's playlist order (#469)", () => {
  it("moves one video up or down by one place, and never past the ends", () => {
    expect(moveReel(["a", "b", "c"], 1, 0)).toEqual(["b", "a", "c"]);
    expect(moveReel(["a", "b", "c"], 1, 2)).toEqual(["a", "c", "b"]);
    expect(moveReel(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
    expect(moveReel(["a", "b", "c"], 2, 9)).toEqual(["a", "b", "c"]);
  });
  it("drags a video to any place and leaves the original list alone", () => {
    const ids = ["a", "b", "c", "d"];
    expect(moveReel(ids, 0, 3)).toEqual(["b", "c", "d", "a"]);
    expect(ids).toEqual(["a", "b", "c", "d"]);
    expect(moveReel(ids, 7, 0)).toEqual(ids);
  });
});

describe("the poster frame", () => {
  it("is taken a tenth in, between a quarter second and two seconds, and inside a very short video", () => {
    expect(posterTime(30)).toBe(2);
    expect(posterTime(5)).toBe(0.5);
    expect(posterTime(1)).toBe(0.25);
    expect(posterTime(0.2)).toBeCloseTo(0.1);
    expect(posterTime(0)).toBe(0);
    expect(posterTime(Number.NaN)).toBe(0);
  });
});

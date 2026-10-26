import { describe, expect, it } from "vitest";

import { clampPlace, nextPlace, nudge } from "./wall-editor";

const at = (x: number, y: number, rotation = 0, z = 1) => ({ x, y, rotation, z });

describe("the wall editor's keyboard (#311)", () => {
  it("moves by one percent, five with Shift", () => {
    expect(nudge(at(10, 10), "ArrowRight", false)).toMatchObject({ x: 11, y: 10 });
    expect(nudge(at(10, 10), "ArrowLeft", true)).toMatchObject({ x: 5 });
    expect(nudge(at(10, 10), "ArrowDown", false)).toMatchObject({ y: 11 });
    expect(nudge(at(10, 10), "ArrowUp", true)).toMatchObject({ y: 5 });
  });
  it("never leaves the wall: 0 to 100 on both axes", () => {
    expect(nudge(at(0, 0), "ArrowLeft", true)).toMatchObject({ x: 0 });
    expect(nudge(at(0, 0), "ArrowUp", true)).toMatchObject({ y: 0 });
    expect(nudge(at(100, 100), "ArrowRight", true)).toMatchObject({ x: 100 });
    expect(nudge(at(98, 100), "ArrowRight", true)).toMatchObject({ x: 100 });
    expect(nudge(at(100, 99), "ArrowDown", true)).toMatchObject({ y: 100 });
  });
  it("tilts with [ and ], within eight degrees", () => {
    expect(nudge(at(5, 5, 0), "]", false)).toMatchObject({ rotation: 1 });
    expect(nudge(at(5, 5, 0), "[", true)).toMatchObject({ rotation: -2 });
    expect(nudge(at(5, 5, 8), "]", true)).toMatchObject({ rotation: 8 });
    expect(nudge(at(5, 5, -7), "[", true)).toMatchObject({ rotation: -8 });
  });
  it("changes the layer, never below zero", () => {
    expect(nudge(at(5, 5, 0, 0), "PageDown", false)).toMatchObject({ z: 0 });
    expect(nudge(at(5, 5, 0, 3), "PageUp", false)).toMatchObject({ z: 4 });
  });
  it("ignores every other key", () => {
    expect(nudge(at(5, 5), "a", false)).toBeNull();
    expect(nudge(at(5, 5), "Enter", false)).toBeNull();
  });
  it("clamps what is typed, and what is not a number becomes zero", () => {
    expect(clampPlace({ x: 140, y: -4, rotation: 30, z: 5000 })).toEqual({ x: 100, y: 0, rotation: 8, z: 1000 });
    expect(clampPlace({ x: Number.NaN, y: 1.234567, rotation: Number.NaN, z: Number.NaN })).toEqual({ x: 0, y: 1.23, rotation: 0, z: 0 });
  });
  it("lays a new item inside the wall, tilted by a small amount", () => {
    for (let n = 0; n < 40; n++) {
      const place = nextPlace(n);
      expect(clampPlace(place)).toEqual(place);
    }
  });
});

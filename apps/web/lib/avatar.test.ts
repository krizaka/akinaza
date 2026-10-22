import { describe, expect, it } from "vitest";

import { avatarChoice, avatarOf } from "./avatar";

describe("the account's avatar", () => {
  it("draws the tone the person chose", () => {
    expect(avatarOf({ id: "a", avatarSeed: "4" })).toEqual({ brand: "akinaza", tone: 4 });
    expect(avatarChoice({ avatarSeed: "4" })).toBe("4");
  });

  it.each([null, undefined, "", "9", "x"])("derives one from the id when the seed is %j", (seed) => {
    expect(avatarOf({ id: "a", avatarSeed: seed })).toEqual({ brand: "akinaza", seed: "a" });
    expect(avatarChoice({ avatarSeed: seed })).toBe("1");
  });
});

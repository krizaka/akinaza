import { describe, expect, it } from "vitest";

import { SETTINGS } from "./settings";

describe("the number of shops an owner may run is the administrator's (#265)", () => {
  it("is global, bounded and defaults to 5", () => {
    const def = SETTINGS["limits.shopsPerOwner"];
    expect(def.default).toBe(5);
    expect(def.scopes).toEqual(["global"]);
    for (const value of [0, -1, 1.5, "5", (def.max ?? 0) + 1]) expect(def.schema.safeParse(value).success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { SETTINGS } from "./settings";

describe("storefront realtime settings", () => {
  it("defaults to enabled with global-only bounded heartbeat and stream limits", () => {
    expect(SETTINGS["realtime.storefront.enabled"].default).toBe(true);
    for (const key of ["realtime.storefront.heartbeatSeconds", "realtime.storefront.maxStreamsPerPage"] as const) {
      const def = SETTINGS[key];
      expect(def.scopes).toEqual(["global"]);
      expect(def.schema.safeParse(def.default).success).toBe(true);
      for (const value of [0, -1, 1.5, Infinity, "15", def.max! + 1]) {
        expect(def.schema.safeParse(value).success).toBe(false);
      }
    }
    expect(SETTINGS["realtime.storefront.enabled"].scopes).toEqual(["global"]);
  });
});

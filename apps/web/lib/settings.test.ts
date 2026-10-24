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

describe("the password reset link's lifetime", () => {
  it("is a setting within @krizaka/auth's bounds, 30 minutes by default, global only", async () => {
    const { PASSWORD_RESET_MAX_MINUTES, PASSWORD_RESET_MIN_MINUTES, PASSWORD_RESET_TTL_MINUTES } = await import("@krizaka/auth");
    const def = SETTINGS["auth.passwordResetTtlMinutes"];
    expect(def.default).toBe(PASSWORD_RESET_TTL_MINUTES);
    expect(def.scopes).toEqual(["global"]);
    expect(def.schema.safeParse(PASSWORD_RESET_MIN_MINUTES).success).toBe(true);
    expect(def.schema.safeParse(PASSWORD_RESET_MAX_MINUTES).success).toBe(true);
    for (const value of [PASSWORD_RESET_MIN_MINUTES - 1, PASSWORD_RESET_MAX_MINUTES + 1, 7.5]) expect(def.schema.safeParse(value).success).toBe(false);
  });
});

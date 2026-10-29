import { afterEach, describe, expect, it, vi } from "vitest";

import { cahierStorefrontOn, resetAppSettings, SETTINGS, shopPaperShown } from "./settings";
import { templateCatalogue } from "./template-rules";

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

/** The service answers like the real one: a person's own value first, else the global one. */
const withFlag = (own: Record<string, boolean>, global = false) => {
  (globalThis as unknown as { __akinazaSettings: unknown }).__akinazaSettings = { get: vi.fn(async (_key: string, ctx: { userId: string | null }) => (ctx.userId && ctx.userId in own ? own[ctx.userId] : global)) };
};

describe("the notebook storefront is the owner's setting (akinaza#316, #261: on for the demo shops' owners only)", () => {
  afterEach(() => resetAppSettings());

  it("is a global-or-person flag, off by default: a code constant never turns it on", () => {
    expect(SETTINGS["features.cahierStorefront"].default).toBe(false);
    expect(SETTINGS["features.cahierStorefront"].scopes).toEqual(expect.arrayContaining(["global", "user"]));
  });

  it("draws the template's paper only for a shop whose owner has it on", async () => {
    withFlag({ "demo-owner": true });
    expect(await shopPaperShown("kraft", "demo-owner")).toBe("kraft");
    expect(await shopPaperShown("kraft", "another-owner")).toBeUndefined();
    expect(await shopPaperShown("kraft", null)).toBeUndefined();
    expect(await shopPaperShown(null, "demo-owner")).toBeUndefined();
  });

  it("offers the @2 templates to that owner only, and the global value reaches everyone", async () => {
    withFlag({ "demo-owner": true });
    expect((await templateCatalogue("demo-owner")).some((t) => t.version === 2)).toBe(true);
    expect((await templateCatalogue("another-owner")).some((t) => t.version === 2)).toBe(false);
    withFlag({}, true);
    expect(await cahierStorefrontOn("another-owner")).toBe(true);
  });
});

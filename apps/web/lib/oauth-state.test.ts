import { addMinutes } from "date-fns";
import { describe, expect, it } from "vitest";

import { signState, verifyState } from "./oauth-state";

const KEY = "k".repeat(40);
const now = new Date("2026-10-19T12:00:00Z");
const ctx = { shopId: "shop-1", platform: "google" as const, now };

describe("the OAuth state", () => {
  it("is accepted for the shop and platform that started it", () => {
    expect(verifyState(signState(ctx, KEY), ctx, KEY)).toBe(true);
  });
  it("is refused for another shop, another platform, another key or a forged value", () => {
    const state = signState(ctx, KEY);
    expect(verifyState(state, { ...ctx, shopId: "shop-2" }, KEY)).toBe(false);
    expect(verifyState(state, { ...ctx, platform: "facebook" }, KEY)).toBe(false);
    expect(verifyState(state, ctx, "x".repeat(40))).toBe(false);
    expect(verifyState(`${state}0`, ctx, KEY)).toBe(false);
    expect(verifyState(null, ctx, KEY)).toBe(false);
  });
  it("expires after ten minutes", () => {
    const state = signState(ctx, KEY);
    expect(verifyState(state, { ...ctx, now: addMinutes(now, 9) }, KEY)).toBe(true);
    expect(verifyState(state, { ...ctx, now: addMinutes(now, 11) }, KEY)).toBe(false);
  });
});

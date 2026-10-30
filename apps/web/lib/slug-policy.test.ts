import { holdSlug } from "@akinaza/core";
import { describe, expect, it, vi } from "vitest";

const stored = vi.hoisted(() => ({ value: "login\n/(a+)+$/\n/^bank(ing)?$/" }));
vi.mock("./settings", () => ({ appSettings: () => ({ get: async (key: string) => (key === "slugs.protectedTerms" ? stored.value : key === "limits.slugChanges" ? 3 : 30) }) }));

import { slugPolicy } from "./slug-policy";

describe("slugPolicy (ADR-005, #537)", () => {
  it("reads the setting into terms that hold a look-alike address", async () => {
    const { terms } = await slugPolicy();
    expect(holdSlug("mon-l0gin", terms!).held).toBe(true);
    expect(holdSlug("banking", terms!).held).toBe(true);
    expect(holdSlug("pattes-saint-henri", terms!).held).toBe(false);
  });
  it("carries the pace of address changes from the settings", async () => {
    expect((await slugPolicy()).slugChanges).toEqual({ max: 3, days: 30 });
  });
  it("never compiles an unsafe pattern that was stored before the check existed", async () => {
    const { terms } = await slugPolicy();
    expect(terms!.map((t) => t.source)).toEqual(["login", "^bank(ing)?$"]);
  });
});

import { shopPresets } from "@krizaka/tokens/shop-presets";
import { describe, expect, it } from "vitest";

import { accentsByLook,acceptedAccents } from "./shop-accents";

describe("the accents of a look", () => {
  it("offers the tested list of the look, led by its own accent", () => {
    expect(acceptedAccents("salon-vitrine")[0]).toBe("akinaza");
    expect(acceptedAccents("salon-atelier")).toContain("akinaza:accent-2");
  });
  it("refuses everything for a look that does not exist", () => {
    expect(acceptedAccents("nope")).toEqual([]);
  });
  it("lists every look, and every accent is a plain name the database accepts", () => {
    const all = accentsByLook();
    expect(Object.keys(all)).toHaveLength(shopPresets.length);
    for (const list of Object.values(all)) for (const name of list) expect(name).toMatch(/^[a-z0-9:-]{1,40}$/);
  });
});

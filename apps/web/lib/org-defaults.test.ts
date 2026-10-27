import type { OrgDefaults } from "@krizaka/org";
import { defaultFor, listDefaults } from "@krizaka/org";
import { describe, expect, it } from "vitest";

import { defaultPicture, pickerChoices } from "./org-defaults";

describe("default pictures come from the org JSON (akinaza#411)", () => {
  it("a shop and a banner get a picture of their own kind, the same for the same seed", () => {
    for (const kind of ["shop", "banner", "person"] as const) {
      const a = defaultPicture(kind, "Salon Alma");
      expect(a, kind).not.toBeNull();
      expect(a!.src).toMatch(new RegExp(`/defaults/v\\d+/${kind}/`));
      expect(defaultPicture(kind, "Salon Alma")).toEqual(a);
    }
  });

  it("falls back to null, never to a guessed URL, when the JSON lacks the kind", () => {
    const empty = { version: "v1", base: "x", rule: {}, kinds: { person: [], folder: [], organisation: [], shop: [], banner: [] } } as unknown as OrgDefaults;
    expect(defaultFor("shop", "Salon Alma", empty)).toBeUndefined();
    expect(listDefaults("banner", empty)).toEqual([]);
  });

  it("a picker never offers a person where a shop or a banner is chosen", () => {
    expect(pickerChoices("shop").every((c) => c.kind === "shop")).toBe(true);
    expect(pickerChoices("banner").every((c) => c.kind === "banner")).toBe(true);
    expect(pickerChoices("person").every((c) => c.kind === "person")).toBe(true);
    expect(pickerChoices("shop").length).toBeGreaterThan(0);
  });
});

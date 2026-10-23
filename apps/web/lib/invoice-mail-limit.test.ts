import { describe, expect, it } from "vitest";

import { SETTINGS } from "./settings";

describe("the invoice e-mail limit is an administrator's setting", () => {
  it("is global, bounded and defaults to 50 sends per shop per day", () => {
    const def = SETTINGS["limits.invoiceEmailsPerShopPerDay"];
    expect(def.default).toBe(50);
    expect(def.scopes).toEqual(["global"]);
    expect(def.schema.safeParse(def.default).success).toBe(true);
    for (const value of [0, -1, 1.5, "50", (def.max ?? 0) + 1]) expect(def.schema.safeParse(value).success).toBe(false);
  });
});

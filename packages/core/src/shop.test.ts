import { describe, expect, it } from "vitest";

import { consentsInForce, EXCLUDED_KINDS, posAllowed, SHOP_KINDS } from "./shop";

describe("Loi 25 consent", () => {
  it("is per purpose, never assumed, and the latest decision wins", () => {
    const at = (d: string) => new Date(d);
    const history = [
      { purpose: "service" as const, granted: true, textVersion: "2026-10-15", at: at("2026-10-15T10:00:00Z") },
      { purpose: "reminders" as const, granted: true, textVersion: "2026-10-15", at: at("2026-10-15T10:00:00Z") },
      { purpose: "reminders" as const, granted: false, textVersion: "2026-10-15", at: at("2026-10-20T10:00:00Z") },
    ];
    expect(consentsInForce(history)).toEqual({ service: true, reminders: false, marketing: false });
    expect(consentsInForce([])).toEqual({ service: false, reminders: false, marketing: false });
  });
});

describe("the kinds of business: services only", () => {
  it("offers no kind that consumes on site (restaurant, café, bar, bakery)", () => {
    for (const kind of ["restaurant", "cafe", "bar", "bakery"]) {
      expect((SHOP_KINDS as readonly string[]).includes(kind)).toBe(false);
      expect((EXCLUDED_KINDS as readonly string[]).includes(kind)).toBe(true);
      expect(posAllowed(kind, true)).toBe(false);
    }
    expect(SHOP_KINDS).toContain("services");
  });
});

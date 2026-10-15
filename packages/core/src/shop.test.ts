import { describe, expect, it } from "vitest";

import { consentsInForce } from "./shop";

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

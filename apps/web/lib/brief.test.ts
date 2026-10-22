import { describe, expect, it } from "vitest";

import { daysInWords } from "./brief";

describe("the brief's words", () => {
  it("names the free days the way a person says them, once each", () => {
    expect(daysInWords(["2026-10-22", "2026-10-24"], "fr")).toBe("jeudi et samedi");
    expect(daysInWords(["2026-10-22", "2026-10-24", "2026-10-29"], "en")).toBe("Thursday and Saturday");
    expect(daysInWords(["2026-10-19", "2026-10-20", "2026-10-21"], "en")).toBe("Monday, Tuesday and Wednesday");
  });
});

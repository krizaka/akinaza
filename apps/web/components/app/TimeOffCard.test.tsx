import { describe, expect, it } from "vitest";

import { timeOffOrderOk } from "./TimeOffCard";

describe("the team's time off is a date range (akinaza#208, K4)", () => {
  it("accepts a range that reads from its first day to its last, and a single day", () => {
    expect(timeOffOrderOk("2026-12-20", "2026-12-27")).toBe(true);
    expect(timeOffOrderOk("2026-12-20", "2026-12-20")).toBe(true);
  });

  it("refuses a range that ends before it starts", () => {
    expect(timeOffOrderOk("2026-12-27", "2026-12-20")).toBe(false);
  });

  it("does not judge a range the form has not finished", () => {
    expect(timeOffOrderOk("", "2026-12-20")).toBe(true);
    expect(timeOffOrderOk("2026-12-20", "")).toBe(true);
  });
});

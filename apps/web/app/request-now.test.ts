import { describe, expect, it } from "vitest";

import { requestNow } from "./request-now";

describe("requestNow", () => {
  it("is the wall clock when nothing is fixed", () => {
    const before = Date.now();
    const at = requestNow({ APP_ENVIRONMENT: "dev" }).getTime();
    expect(at).toBeGreaterThanOrEqual(before);
    expect(at).toBeLessThanOrEqual(Date.now());
  });

  it("is the fixed instant in a dev deployment, so a captured page does not follow the hour of the run", () => {
    expect(requestNow({ APP_ENVIRONMENT: "dev", APP_FIXED_NOW: "2026-10-28T15:00:00Z" }).toISOString()).toBe("2026-10-28T15:00:00.000Z");
  });

  it("ignores the fixed instant in production", () => {
    const before = Date.now();
    expect(requestNow({ APP_ENVIRONMENT: "prod", APP_FIXED_NOW: "2026-10-28T15:00:00Z" }).getTime()).toBeGreaterThanOrEqual(before);
  });

  it("refuses an instant that is not a date, rather than drawing an invalid one", () => {
    expect(() => requestNow({ APP_ENVIRONMENT: "dev", APP_FIXED_NOW: "yesterday" })).toThrow();
  });
});

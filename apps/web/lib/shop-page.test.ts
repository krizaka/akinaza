import { describe, expect, it } from "vitest";

import { queryString } from "./shop-page";

describe("a moved shop keeps the visitor's choices (#77)", () => {
  it("rebuilds the query of the page it redirects", () => {
    expect(queryString({})).toBe("");
    expect(queryString({ staff: "julie", zone: undefined })).toBe("?staff=julie");
    expect(queryString({ day: ["2026-10-22", "2026-10-23"], zone: "st henri" })).toBe("?day=2026-10-22&day=2026-10-23&zone=st+henri");
  });
});

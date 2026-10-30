import { describe, expect, it } from "vitest";

import { errorFields, errorKey } from "./client";

describe("what the browser reads of a refusal (akinaza#489)", () => {
  it("names the fields of a 400, so a form can point at one", () => {
    const refusal = { status: 400, body: { code: "BAD_REQUEST", fields: ["slug", 3, "name"] } };
    expect(errorKey(refusal)).toBe("BAD_REQUEST");
    expect(errorFields(refusal)).toEqual(["slug", "name"]);
  });
  it("is empty when the refusal names none", () => {
    expect(errorFields(new TypeError("fetch failed"))).toEqual([]);
    expect(errorFields(null)).toEqual([]);
  });
});

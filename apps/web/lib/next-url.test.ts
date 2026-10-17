import { describe, expect, it } from "vitest";

import { backToHere, safeNext } from "./next-url";

describe("where sign-in sends the visitor back to", () => {
  it("keeps a page of the shop in the visitor's language, with the choice they made (service, area, time)", () => {
    const here = "/fr/s/pattes/book?service=abc&zone=def&start=2026-10-20T13%3A00%3A00.000Z";
    expect(safeNext(here, "fr")).toBe(here);
    expect(safeNext("/fr/app", "fr")).toBe("/fr/app");
  });
  it("refuses another language's page, another site, a protocol-relative address and anything with odd characters", () => {
    for (const bad of ["/en/app", "https://evil.test/fr/app", "//evil.test", "/fr//evil.test", "/fr/app?next=<script>", "/fr/app?x=1#frag", "javascript:alert(1)", "/fr/../admin"]) {
      expect(safeNext(bad, "fr"), bad).toBe("/fr/app");
    }
    expect(safeNext(undefined, "fr")).toBe("/fr/app");
  });
  it("builds the return address from the path and the query of the page that asked for the sign-in", () => {
    expect(backToHere("/fr/s/pattes/book", { service: "s1", zone: ["z1", "z2"], start: undefined, empty: "" })).toBe("/fr/s/pattes/book?service=s1&zone=z1");
    expect(backToHere("/fr/s/pattes/book", {})).toBe("/fr/s/pattes/book");
  });
});

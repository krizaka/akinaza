import { describe, expect, it } from "vitest";

import { backToHere, safeNext, signInUrl } from "./next-url";

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

describe("the signed-in guard's redirect (#287)", () => {
  it("passes the requested page as `next`, so a deep link lands there after sign-in", () => {
    expect(signInUrl("fr", "/fr/app/invoices")).toBe("/fr/sign-in?next=%2Ffr%2Fapp%2Finvoices");
    expect(signInUrl("en", "/en/app/shop/clients?q=a")).toBe("/en/sign-in?next=%2Fen%2Fapp%2Fshop%2Fclients%3Fq%3Da");
  });
  it("sends no destination when there is none, or when it is not a page of this site in this language", () => {
    expect(signInUrl("fr", null)).toBe("/fr/sign-in");
    expect(signInUrl("fr", "/en/app")).toBe("/fr/sign-in");
    expect(signInUrl("fr", "//evil.test")).toBe("/fr/sign-in");
  });
});

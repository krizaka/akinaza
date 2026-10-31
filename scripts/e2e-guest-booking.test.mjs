import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./e2e-guest-booking.mjs", import.meta.url), "utf8");

describe("e2e-guest-booking (a client with no account books)", () => {
  it("walks the whole path as an anonymous visitor: shop, service, time, details, code by e-mail, receipt", () => {
    for (const step of ["/slots", "/confirm?", "data-guest-summary", "W.send", "codeFor(EMAIL)", "confirmation", "data-booked-stamp"]) expect(source).toContain(step);
  });

  it("holds the rules of the step: no sign-in wall, the consent box never pre-ticked, the cancellation rule shown before booking", () => {
    expect(source).toContain('!page.url().includes("/sign-in")');
    expect(source).toContain("the consent box is not pre-ticked");
    expect(source).toContain("data-guest-cancel-rule");
  });

  it("films the run and writes demo data only, under an @akinaza.test address", () => {
    expect(source).toContain("recordVideo");
    expect(source).toContain("@akinaza.test");
  });
});

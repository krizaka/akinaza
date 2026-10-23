import { describe, expect, it } from "vitest";

import { CLIENT_PLACES, placeHrefFor, placesFor } from "./app-nav";

describe("the rail of each role (docs/ux/2026-10-full-review.md § 4.1): five destinations at most, the account never among them", () => {
  it.each([
    ["owner", ["today", "clients", "invoices", "books", "shop"]],
    ["manager", ["today", "clients", "invoices", "books", "shop"]],
    ["staff", ["today"]],
  ] as const)("%s", (role, places) => expect(placesFor(role)).toEqual(places));

  it("never puts the account on the rail: it is under the avatar", () => {
    for (const role of ["owner", "manager", "staff"] as const) expect(placesFor(role)).not.toContain("profile");
    expect(CLIENT_PLACES).not.toContain("profile");
  });

  it("gives someone who works in no shop (a client) their bookings alone", () => {
    expect(CLIENT_PLACES).toEqual(["bookings"]);
  });

  it("leads « Boutique » to the page editor for who may set the shop up, and to the team for who may only see the team", () => {
    expect(placeHrefFor("fr", { shopId: "s-1", role: "owner" }, "shop")).toBe("/fr/app/s-1/shop");
    expect(placeHrefFor("fr", { shopId: "s-1", role: "manager" }, "shop")).toBe("/fr/app/s-1/team");
    expect(placeHrefFor("fr", { shopId: "s-1", role: "owner" }, "today")).toBe("/fr/app/s-1/aujourdhui");
    expect(placeHrefFor("en", null, "bookings")).toBe("/en/app");
  });
});

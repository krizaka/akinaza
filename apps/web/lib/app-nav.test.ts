import { describe, expect, it } from "vitest";

import { CLIENT_PLACES, headerActionFits, placeHrefFor, placesFor } from "./app-nav";

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

  it("never shows a client a « boutique » place: opening a shop is an action of their page, not a destination (K7)", () => {
    expect(CLIENT_PLACES).not.toContain("shop");
    expect(CLIENT_PLACES.map((place) => placeHrefFor("fr", null, place))).toEqual(["/fr/app"]);
  });

  it("leads « Boutique » to its hub's first section: the page for who may set the shop up, the team for who may only see the team", () => {
    expect(placeHrefFor("fr", { shopId: "s-1", role: "owner" }, "shop")).toBe("/fr/app/s-1/boutique/page");
    expect(placeHrefFor("fr", { shopId: "s-1", role: "manager" }, "shop")).toBe("/fr/app/s-1/boutique/team");
    expect(placeHrefFor("fr", { shopId: "s-1", role: "owner" }, "today")).toBe("/fr/app/s-1/aujourdhui");
    expect(placeHrefFor("en", null, "bookings")).toBe("/en/app");
  });

  it("the frame's « Nouvelle facture » yields on the settings hub and on an invoice's own screens, and stays on the lists", () => {
    for (const path of ["/fr/app/s-1/aujourdhui", "/fr/app/s-1/invoices", "/fr/app/s-1/clients"]) expect(headerActionFits(path), path).toBe(true);
    for (const path of ["/fr/app/s-1/boutique", "/fr/app/s-1/boutique/page", "/fr/app/s-1/boutique/team", "/fr/app/s-1/invoices/new", "/fr/app/s-1/invoices/abc123", "/fr/app/s-1/invoices/abc123/correct"]) expect(headerActionFits(path), path).toBe(false);
  });
});

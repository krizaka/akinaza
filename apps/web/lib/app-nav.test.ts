import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { CLIENT_PLACES, placeHrefFor, placesFor, screenPrimary } from "./app-nav";

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
    expect(placeHrefFor("fr", { shopId: "s-1", role: "owner" }, "shop")).toBe("/fr/app/s-1/settings/page");
    expect(placeHrefFor("fr", { shopId: "s-1", role: "manager" }, "shop")).toBe("/fr/app/s-1/settings/team");
    expect(placeHrefFor("fr", { shopId: "s-1", role: "owner" }, "today")).toBe("/fr/app/s-1/today");
    expect(placeHrefFor("en", null, "bookings")).toBe("/en/app");
  });
});

/**
 * One primary per screen (errata 2 of docs/ux/2026-10-full-review.md, revised in D1b): who carries it on each owner route. The
 * header's « Nouvelle facture » on the lists; the page's own on the day (the next appointment), the hub (its section's save) and an
 * invoice's screens (send, correct, issue). Every page of the shop's space is in this table (an old address that answers 308 is a redirect of `next.config.mjs`, not a page): a new one must say who holds its primary.
 */
const OWNER_SCREENS: Record<string, "header" | "page"> = {
  "today": "page",
  "books": "header",
  "settings": "page",
  "settings/[section]": "page",
  "brief": "header",
  "clients": "header",
  "clients/[id]": "header",
  "invoices": "header",
  "invoices/[id]": "page",
  "invoices/[id]/correct": "page",
  "invoices/new": "page",
  "shop/new": "page",
};

const SHOP_SPACE = fileURLToPath(new URL("../app/[locale]/(app)/app/[shop]/", import.meta.url));
const ownerRoutes = (): string[] =>
  (readdirSync(SHOP_SPACE, { recursive: true }) as string[]).filter((f) => f.endsWith("page.tsx")).map((f) => f.replace(/\\/g, "/").replace(/\/?page\.tsx$/, ""));
const sample = (route: string) => `/fr/app/s-1/${route.replace("[id]", "abc123").replace("[section]", "page")}`;

describe("one primary per screen: the header's « Nouvelle facture » or the page's own, never both", () => {
  it("every page of the shop's space says who holds its primary", () => {
    expect(ownerRoutes().sort()).toEqual(Object.keys(OWNER_SCREENS).sort());
  });

  it.each(Object.entries(OWNER_SCREENS))("%s: the %s", (route, owner) => {
    expect(screenPrimary(sample(route))).toBe(owner);
  });

  it("gives the day its own primary, the next appointment: the header yields on Aujourd'hui", () => {
    expect(screenPrimary("/fr/app/s-1/today")).toBe("page");
    expect(screenPrimary("/en/app/s-1/today?day=2026-10-23")).toBe("page");
  });
});

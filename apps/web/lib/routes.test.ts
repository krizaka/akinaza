import { describe, expect, it } from "vitest";

import { accountRoutes, inOtherShop, isShopId, placeHref, shopRoutes } from "./routes";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("the routes of the signed-in space", () => {
  it("puts the shop in the path of every address", () => {
    const r = shopRoutes("fr", A);
    expect(r.today()).toBe(`/fr/app/${A}/aujourdhui`);
    expect(r.today("2026-10-23", "x")).toBe(`/fr/app/${A}/aujourdhui?day=2026-10-23&appointment=x`);
    expect(r.client("c1")).toBe(`/fr/app/${A}/clients/c1`);
    expect(r.books("this-quarter")).toBe(`/fr/app/${A}/books?period=this-quarter`);
    expect(r.api("/api/walker/team")).toBe(`/api/walker/team?shopId=${A}`);
    expect(r.api("/api/walker/x?a=1")).toBe(`/api/walker/x?a=1&shopId=${A}`);
    expect(r.newInvoice).toBe(`/fr/app/${A}/invoices/new`);
  });

  it("keeps the account's pages out of any shop", () => {
    expect(accountRoutes("en")).toEqual({ home: "/en/app", profile: "/en/app/profile", security: "/en/app/profile/security" });
  });

  it.each([
    ["today", `/en/app/${A}/aujourdhui`],
    ["clients", `/en/app/${A}/clients`],
    ["team", `/en/app/${A}/team`],
    ["shop", `/en/app/${A}/shop`],
    ["profile", "/en/app/profile"],
  ] as const)("leads the bar's %s to %s", (place, href) => expect(placeHref("en", A, place)).toBe(href));

  it("leads a client, who works in no shop, to the account's home", () => {
    expect(placeHref("en", null, "bookings")).toBe("/en/app");
    expect(placeHref("en", null, "shop")).toBe("/en/app");
  });

  it("recognises a shop id, and nothing else", () => {
    expect(isShopId(A)).toBe(true);
    for (const bad of ["clients", "profile", "", `${A}x`]) expect(isShopId(bad)).toBe(false);
  });

  it("carries the page to another shop, except a record that belongs to the first", () => {
    expect(inOtherShop("en", `/en/app/${A}/invoices`, A, B)).toBe(`/en/app/${B}/invoices`);
    expect(inOtherShop("en", `/en/app/${A}/invoices/new`, A, B)).toBe(`/en/app/${B}/invoices/new`);
    expect(inOtherShop("en", `/en/app/${A}/clients/c1`, A, B)).toBe(`/en/app/${B}/aujourdhui`);
    expect(inOtherShop("en", "/en/app/profile", A, B)).toBe(`/en/app/${B}/aujourdhui`);
  });
});

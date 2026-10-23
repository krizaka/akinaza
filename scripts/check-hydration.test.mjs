import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ACCOUNT_PAGES, BROWSER, firstRecord, isHydrationError, OWNER_PAGES, PUBLIC_PAGES, THEMES, VIEWPORTS } from "./check-hydration.mjs";

describe("the hydration crawl (one rendering for the server and the browser, K0)", () => {
  it("hydrates in a visitor's browser — Montréal's clock and the product's first language — never the server's UTC", () => {
    expect(BROWSER.timezoneId).toBe("America/Toronto");
    expect(BROWSER.locale).toBe("fr-CA");
  });

  it("covers every screen the review found broken: the legal page, the storefronts, the owner's day, clients, invoices, books, team, the account", () => {
    for (const page of ["/fr/privacy", "/fr/s/cedre-ciseaux", "/fr/s/encre-vive", "/fr/s/pattes-saint-henri", "/fr", "/fr/sign-in", "/fr/nope"]) expect(PUBLIC_PAGES).toContain(page);
    for (const page of ["/aujourdhui", "/clients", "/invoices", "/invoices/new", "/books", "/team", "/shop"]) expect(OWNER_PAGES).toContain(page);
    for (const page of ["/app/profile", "/app/profile/security"]) expect(ACCOUNT_PAGES).toContain(page);
    expect(THEMES).toEqual(["dark", "light"]);
    expect(VIEWPORTS.map((v) => v.width)).toEqual([1440, 390]);
  });

  it("recognises React's hydration errors, minified or not", () => {
    expect(isHydrationError("Minified React error #418; visit https://react.dev/errors/418?args[]=text&args[]= for the full message")).toBe(true);
    expect(isHydrationError("Minified React error #425; visit …")).toBe(true);
    expect(isHydrationError("Hydration failed because the server rendered text didn't match the client.")).toBe(true);
    expect(isHydrationError("A tree hydrated but some attributes of the server rendered HTML didn't match the client properties.")).toBe(true);
    expect(isHydrationError("Failed to load resource: the server responded with a status of 404")).toBe(false);
  });

  it("refuses a console error and an uncaught exception on any page, and signs in through the product's own route", () => {
    const source = readFileSync(new URL("./check-hydration.mjs", import.meta.url), "utf8");
    for (const needle of ['page.on("console"', 'page.on("pageerror"', "/api/auth/sign-in", 'localStorage.setItem("kz-theme"']) expect(source).toContain(needle);
  });

  it("crawls the first record of a list, never its creation page nor a deeper address", () => {
    const shop = "/fr/app/0b1c";
    const invoices = [`${shop}/invoices/new`, `${shop}/invoices/i-1`, `${shop}/invoices/i-2`, `${shop}/invoices/i-1/correct`];
    expect(firstRecord(invoices, `${shop}/invoices`)).toBe(`${shop}/invoices/i-1`);
    expect(firstRecord([`${shop}/invoices/new?client=c-1`, `${shop}/invoices/i-1/correct`, `${shop}/clients/c-1`], `${shop}/invoices`)).toBeNull();
    expect(firstRecord([`${shop}/clients`, null, `${shop}/clients/c-9`], `${shop}/clients`)).toBe(`${shop}/clients/c-9`);
  });

  it("lets another visitor be tried (--locale, --timezone) and expects the two 404 checks to answer 404", () => {
    const source = readFileSync(new URL("./check-hydration.mjs", import.meta.url), "utf8");
    for (const needle of ['arg("timezone", BROWSER.timezoneId)', 'arg("locale", BROWSER.locale)', "expected404 ? status !== 404 : status >= 400"]) expect(source).toContain(needle);
    expect(PUBLIC_PAGES.filter((p) => p.endsWith("/nope"))).toEqual(["/fr/s/nope", "/fr/nope"]);
  });
});

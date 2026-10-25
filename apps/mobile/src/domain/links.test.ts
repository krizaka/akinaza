import { asLocale, legacyRoute, routes, safeNext, TABS } from "./links";

const S = "6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b";

describe("the app's links are the web's paths", () => {
  it("follows the device's language, French first", () => {
    expect([asLocale("fr-CA"), asLocale("en-US"), asLocale("de"), asLocale(null)]).toEqual(["fr", "en", "fr", "fr"]);
  });

  it("writes each screen at the web's address of the shop (apps/web lib/routes.ts shopRoutes), the state in the query (D8)", () => {
    expect(routes.home("fr")).toBe("/fr/app");
    expect(routes.today("fr", S)).toBe(`/fr/app/${S}/aujourdhui`);
    expect(routes.today("fr", S, "2026-10-20")).toBe(`/fr/app/${S}/aujourdhui?day=2026-10-20`);
    expect(routes.clients("fr", S)).toBe(`/fr/app/${S}/clients`);
    expect(routes.clients("fr", S, "Camille Roy")).toBe(`/fr/app/${S}/clients?q=Camille%20Roy`);
    expect(routes.invoices("en", S)).toBe(`/en/app/${S}/invoices`);
    expect(routes.newInvoice("fr", S)).toBe(`/fr/app/${S}/invoices/new`);
    expect(routes.newInvoice("fr", S, "c1")).toBe(`/fr/app/${S}/invoices/new?client=c1`);
    expect(routes.books("fr", S)).toBe(`/fr/app/${S}/books`);
    expect(routes.books("fr", S, "2026-Q3")).toBe(`/fr/app/${S}/books?period=2026-Q3`);
    expect(routes.boutique("en", S)).toBe(`/en/app/${S}/boutique`);
    expect(routes.profile("en")).toBe("/en/app/profile");
  });

  it("has the web's five places, in the rail's order: Aujourd'hui, Clients, Factures, Livres, Boutique", () => {
    expect(TABS.map((t) => t.name)).toEqual(["aujourdhui", "clients", "invoices", "books", "boutique"]);
    expect(TABS.map((t) => t.href("fr", S))).toEqual([routes.today("fr", S), routes.clients("fr", S), routes.invoices("fr", S), routes.books("fr", S), routes.boutique("fr", S)]);
  });

  it("sends the old short addresses to the shop's own: the calendar into Aujourd'hui, the settings to the profile", () => {
    expect(legacyRoute("fr", "calendar", S)).toBe(routes.today("fr", S));
    expect(legacyRoute("fr", "clients", S)).toBe(routes.clients("fr", S));
    expect(legacyRoute("en", "invoices", S)).toBe(routes.invoices("en", S));
    expect(legacyRoute("fr", "invoices/new", S)).toBe(routes.newInvoice("fr", S));
    expect(legacyRoute("fr", "settings", S)).toBe(routes.profile("fr"));
  });

  it("after signing in, resumes the screen a link asked for, and only an app screen", () => {
    expect(safeNext(`/fr/app/${S}/invoices/new?client=c1`, "fr")).toBe(`/fr/app/${S}/invoices/new?client=c1`);
    expect(safeNext(`/en/app/${S}/aujourdhui?day=2026-10-20`, "fr")).toBe(`/en/app/${S}/aujourdhui?day=2026-10-20`);
    for (const bad of [undefined, "", "https://evil.example/fr/app", "//evil.example", "/fr/application", "/fr/app//x", "/admin"]) expect(safeNext(bad, "fr")).toBe("/fr/app");
  });
});

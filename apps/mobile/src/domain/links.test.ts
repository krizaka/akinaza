import { asLocale, routes, safeNext } from "./links";

describe("the app's links are the web's paths", () => {
  it("follows the device's language, French first", () => {
    expect([asLocale("fr-CA"), asLocale("en-US"), asLocale("de"), asLocale(null)]).toEqual(["fr", "en", "fr", "fr"]);
  });

  it("writes each screen's path, the state in the query", () => {
    expect(routes.today("fr")).toBe("/fr/app");
    expect(routes.today("fr", "2026-10-20")).toBe("/fr/app?date=2026-10-20");
    expect(routes.calendar("en", "2026-10")).toBe("/en/app/calendar?month=2026-10");
    expect(routes.invoices("fr")).toBe("/fr/app/invoices");
    expect(routes.newInvoice("fr")).toBe("/fr/app/invoices/new");
    expect(routes.newInvoice("fr", "c1")).toBe("/fr/app/invoices/new?client=c1");
    expect(routes.clients("fr", "Camille Roy")).toBe("/fr/app/clients?q=Camille%20Roy");
    expect(routes.settings("en")).toBe("/en/app/settings");
  });

  it("after signing in, resumes the screen a link asked for, and only an app screen", () => {
    expect(safeNext("/fr/app/invoices/new?client=c1", "fr")).toBe("/fr/app/invoices/new?client=c1");
    expect(safeNext("/en/app/calendar?month=2026-10", "fr")).toBe("/en/app/calendar?month=2026-10");
    for (const bad of [undefined, "", "https://evil.example/fr/app", "//evil.example", "/fr/application", "/fr/app//x", "/admin"]) expect(safeNext(bad, "fr")).toBe("/fr/app");
  });
});

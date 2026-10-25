import { describe, expect, it } from "vitest";

import { CLIENT_FILTERS, clientsView, readClientsQuery } from "./clients-view";

const row = (fullName: string, over: Partial<Parameters<typeof clientsView>[0][number]> = {}) => ({ id: fullName, fullName, email: null, phone: null, visits: 0, lastVisitAt: null, nextVisitAt: null, spentCents: 0, owedCents: 0, ...over });
const shop = [
  row("Studio Lumen inc.", { owedCents: 3_174, email: "contact@lumen.test" }),
  row("Atelier Boréal inc.", { nextVisitAt: "2026-10-30T14:00:00.000Z" }),
  row("Nord Studio Montréal Ltd.", { owedCents: 12_000, nextVisitAt: "2026-10-28T14:00:00.000Z" }),
  row("Camille Tremblay"),
];

describe("Clients on the catalogue (D5): the plan strip, the search and the filters with their counts", () => {
  it("counts every filter on the whole shop, whatever is shown", () => {
    const view = clientsView(shop, { q: "", filter: "due" });
    expect(view.counts).toEqual({ all: 4, due: 2, upcoming: 2 });
    expect(view.rows.map((r) => r.fullName)).toEqual(["Studio Lumen inc.", "Nord Studio Montréal Ltd."]);
  });

  it("sums what is owed and how many are up to date for the strip", () => {
    expect(clientsView(shop, { q: "", filter: "all" }).strip).toEqual({ count: 4, owedCents: 15_174, upToDate: 2 });
  });

  it("searches a name or an e-mail, whatever the case and the accents", () => {
    expect(clientsView(shop, { q: "boreal", filter: "all" }).rows.map((r) => r.fullName)).toEqual(["Atelier Boréal inc."]);
    expect(clientsView(shop, { q: "LUMEN.TEST", filter: "all" }).rows.map((r) => r.fullName)).toEqual(["Studio Lumen inc."]);
    expect(clientsView(shop, { q: "studio", filter: "upcoming" }).rows.map((r) => r.fullName)).toEqual(["Nord Studio Montréal Ltd."]);
  });

  it("reads the address: an unknown filter is « all », the query trimmed", () => {
    expect(readClientsQuery({ q: "  lumen ", filter: "nope" })).toEqual({ q: "lumen", filter: "all" });
    expect(readClientsQuery({ filter: "due" })).toEqual({ q: "", filter: "due" });
    expect(CLIENT_FILTERS).toEqual(["all", "due", "upcoming"]);
  });
});

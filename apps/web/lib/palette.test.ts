import { describe, expect, it } from "vitest";

import { isPaletteShortcut, paletteItems } from "./palette";
import { shopRoutes } from "./routes";

const routes = shopRoutes("fr", "s-1");
const actions = [{ id: "action:new-invoice", group: "actions" as const, label: "Nouvelle facture", href: routes.newInvoice }];

describe("the palette (⌘K): the shop's clients, invoices and actions, each one an address", () => {
  it("opens on ⌘K on a Mac and Ctrl+K elsewhere, never on K alone nor with Alt", () => {
    expect(isPaletteShortcut({ key: "k", metaKey: true, ctrlKey: false, altKey: false })).toBe(true);
    expect(isPaletteShortcut({ key: "K", metaKey: false, ctrlKey: true, altKey: false })).toBe(true);
    expect(isPaletteShortcut({ key: "k", metaKey: false, ctrlKey: false, altKey: false })).toBe(false);
    expect(isPaletteShortcut({ key: "k", metaKey: true, ctrlKey: false, altKey: true })).toBe(false);
  });

  it("lists the clients and the invoices found first, each leading to its screen of the shop, then the actions the query names", () => {
    const items = paletteItems({ clients: [{ id: "c-1", fullName: "Studio Lumen inc." }], invoices: [{ id: "i-1", number: "2026-0007", client: "Studio Lumen inc." }] }, routes, actions, "lum");
    expect(items.map((i) => [i.group, i.label, i.href])).toEqual([
      ["clients", "Studio Lumen inc.", "/fr/app/s-1/clients/c-1"],
      ["invoices", "2026-0007", "/fr/app/s-1/invoices/i-1"],
    ]);
    expect(items[1]!.hint).toBe("Studio Lumen inc.");
    expect(paletteItems(undefined, routes, actions, "FACTURE").map((i) => i.id)).toEqual(["action:new-invoice"]);
    expect(paletteItems(undefined, routes, actions, "facturé").map((i) => i.id)).toEqual(["action:new-invoice"]);
  });

  it("shows the actions alone before anything is found", () => {
    expect(paletteItems(undefined, routes, actions, "").map((i) => i.id)).toEqual(["action:new-invoice"]);
  });
});

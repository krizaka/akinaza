import type { ShopRoutes } from "./routes";

/** ⌘K on a Mac, Ctrl+K elsewhere: the family's shortcut for the palette. */
export const isPaletteShortcut = (e: { key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean }): boolean => (e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k";

export interface PaletteItem {
  id: string;
  group: "actions" | "clients" | "invoices";
  label: string;
  /** A second line: an invoice's client. */
  hint?: string;
  href: string;
}

/** What the search route answers: the shop's own client files and invoices (`searchShop`). */
export interface PaletteFound {
  clients: { id: string; fullName: string }[];
  invoices: { id: string; number: string; client: string | null }[];
}

/** A label as typed: no case, no accent (« facturé » finds « Nouvelle facture »). */
const plain = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * The palette's options, in its order: the clients and the invoices found, each an address of the shop, then the actions whose
 * words hold the query (all of them before anything is typed).
 */
export function paletteItems(found: PaletteFound | undefined, routes: Pick<ShopRoutes, "client" | "invoice">, actions: readonly PaletteItem[], query: string): PaletteItem[] {
  const q = plain(query.trim());
  return [
    ...(found?.clients ?? []).map((c): PaletteItem => ({ id: `client:${c.id}`, group: "clients", label: c.fullName, href: routes.client(c.id) })),
    ...(found?.invoices ?? []).map((i): PaletteItem => ({ id: `invoice:${i.id}`, group: "invoices", label: i.number, hint: i.client ?? undefined, href: routes.invoice(i.id) })),
    ...actions.filter((a) => plain(a.label).includes(q)),
  ];
}

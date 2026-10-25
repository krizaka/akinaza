import type { ClientRowView } from "@/components/app/ClientsTable";

/** The filter chips of Clients, in their order (`?filter=`): everyone, who still owes, who comes back. */
export const CLIENT_FILTERS = ["all", "due", "upcoming"] as const;
export type ClientFilter = (typeof CLIENT_FILTERS)[number];

export interface ClientsQuery {
  q: string;
  filter: ClientFilter;
}

/** The list's state from its address (`?q=&filter=`): back, forward and a shared link keep it. */
export function readClientsQuery(params: { q?: string; filter?: string }): ClientsQuery {
  const filter = CLIENT_FILTERS.find((f) => f === params.filter) ?? "all";
  return { q: (params.q ?? "").trim(), filter };
}

/** No case, no accent: « boreal » finds « Boréal ». */
const plain = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const MATCHES: Record<ClientFilter, (c: ClientRowView) => boolean> = {
  all: () => true,
  due: (c) => c.owedCents > 0,
  upcoming: (c) => c.nextVisitAt !== null,
};

/**
 * Clients on the catalogue template (D5): the rows the search and the filter keep, the count of each filter on the whole shop
 * (what a chip promises before it is chosen), and the plan strip — how many clients, what they owe, how many are up to date.
 */
export function clientsView(clients: readonly ClientRowView[], { q, filter }: ClientsQuery) {
  const needle = plain(q);
  const found = needle ? clients.filter((c) => plain(`${c.fullName} ${c.email ?? ""} ${c.phone ?? ""}`).includes(needle)) : clients;
  return {
    rows: found.filter(MATCHES[filter]),
    counts: Object.fromEntries(CLIENT_FILTERS.map((f) => [f, clients.filter(MATCHES[f]).length])) as Record<ClientFilter, number>,
    strip: { count: clients.length, owedCents: clients.reduce((n, c) => n + c.owedCents, 0), upToDate: clients.filter((c) => c.owedCents === 0).length },
  };
}

/** The binder's sections of a client's file (D5), in their order; the first is the address without `?tab=`. */
export const CLIENT_FILE_TABS = ["summary", "invoices", "visits", "notes"] as const;
export type ClientFileTab = (typeof CLIENT_FILE_TABS)[number];
export const readClientFileTab = (tab: string | undefined): ClientFileTab => CLIENT_FILE_TABS.find((t) => t === tab) ?? "summary";

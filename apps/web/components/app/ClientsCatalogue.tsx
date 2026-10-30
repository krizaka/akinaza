"use client";

import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { ChipLink } from "@krizaka/ui/chip-link";
import { DataTable, type DataTableColumn, dataTableCsv } from "@krizaka/ui/data-table";
import { EmptyState } from "@krizaka/ui/empty-state";
import { Mascot } from "@krizaka/ui/mascots";
import { Meter } from "@krizaka/ui/meter";
import { SearchField } from "@krizaka/ui/search-field";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ClientAvatar, type ClientRowView } from "@/components/app/ClientsTable";
import { SelectionTags, TagBinder, TagChips, ViewsBar } from "@/components/app/organize";
import { useShopRoutes } from "@/components/app/ShopSession";
import { ButtonLink } from "@/components/ButtonLink";
import { CLIENT_FILTERS, type ClientsQuery, clientsView } from "@/lib/clients-view";
import { formatDate, formatMoney } from "@/lib/format";
import { type Say, type SayLocale, useSay } from "@/lib/i18n-client";
import { listHref, type OrganizeData, type TagLite } from "@/lib/organize-view";
import type { ShopRoutes } from "@/lib/routes";
import { useTableLabels } from "@/lib/table-labels";

/** The address of the list for a query: an empty search and « all » leave no parameter; the tags, dates and view in force stay (the URL is the state). */
const hrefOf = (organize: OrganizeData) => (pathname: string, { q, filter }: ClientsQuery) =>
  listHref(pathname, { ...organize.filters, q: undefined }, organize.view, { q: q || undefined, filter: filter === "all" ? undefined : filter });

type ClientColumnsContext = { say: Say; locale: SayLocale; timeZone: string; routes: ShopRoutes; tagsByClient: Record<string, TagLite[]> };

/** Built outside the component: the cells are render functions, not components of the table's parent. */
const clientColumns = ({ say, locale, timeZone, routes, tagsByClient }: ClientColumnsContext): DataTableColumn<ClientRowView>[] => {
  const day = (iso: string | null) => (iso ? formatDate(iso, locale, timeZone) : say("clients.never"));
  return [
    {
      id: "client",
      header: say("clients.columns.client"),
      type: "title",
      card: "title",
      sortable: true,
      minWidth: 220,
      value: (c) => c.fullName,
      cell: (c) => (
        <Link href={routes.client(c.id)} className="flex items-center gap-3 font-semibold text-fg hover:underline">
          <ClientAvatar id={c.id} name={c.fullName} />
          {c.fullName}
        </Link>
      ),
      subtitle: (c) => c.email ?? c.phone ?? "",
    },
    { id: "tags", header: say("organize.columns.tags"), priority: 2, value: (c) => (tagsByClient[c.id] ?? []).map((t) => t.name).join(", "), cell: (c) => <TagChips tags={tagsByClient[c.id]} /> },
    {
      id: "state",
      header: say("clients.columns.state"),
      type: "status",
      value: (c) => c.owedCents,
      cell: (c) => (c.owedCents > 0 ? <Badge tone="warning">{say("clients.state.owes", { amount: formatMoney(c.owedCents, locale) })}</Badge> : <Badge tone="success">{say("clients.state.upToDate")}</Badge>),
    },
    { id: "visits", header: say("clients.columns.visits"), type: "number", sortable: true, priority: 3, value: (c) => c.visits },
    { id: "last", header: say("clients.columns.last"), sortable: true, priority: 2, nowrap: true, value: (c) => c.lastVisitAt ?? "", cell: (c) => day(c.lastVisitAt) },
    { id: "next", header: say("clients.columns.next"), sortable: true, priority: 2, nowrap: true, value: (c) => c.nextVisitAt ?? "", cell: (c) => day(c.nextVisitAt) },
    {
      id: "bill",
      header: say("clients.columns.bill"),
      headerHidden: true,
      hideable: false,
      cell: (c) => (
        <ButtonLink href={routes.newInvoiceFor({ client: c.id })} variant="secondary" size="sm">
          {say("clients.file.bill")}
        </ButtonLink>
      ),
    },
  ];};

/** The actions of a selection, built outside the component: a render function, not a component of the table's parent. */
function bulkActions({ organize, selected, onExport, exportLabel }: { organize: OrganizeData; selected: string[]; onExport: () => void; exportLabel: string }) {
  return function BulkActions({ clear }: Readonly<{ clear: () => void }>) {
    return (
      <>
        <SelectionTags organize={organize} selected={selected} onDone={clear} />
        <Button variant="secondary" size="sm" onClick={onExport}>
          {exportLabel}
        </Button>
      </>
    );
  };
}

/**
 * Clients on the catalogue template (D5, review K3b): the plan strip (how many, what they owe, a meter of who is up to date),
 * the search and the filter chips with their counts — all in the address —, then the rows with their state and « Facturer »;
 * the tags are the binder's dividers, the views are links (akinaza#337); selected rows are tagged, untagged (at most 200) or exported. A name opens the client's file.
 */
export function ClientsCatalogue({ clients, query, timeZone, organize, tagsByClient }: Readonly<{ clients: ClientRowView[]; query: ClientsQuery; timeZone: string; organize: OrganizeData; tagsByClient: Record<string, TagLite[]> }>) {
  const { say, locale } = useSay();
  const routes = useShopRoutes();
  const router = useRouter();
  const pathname = usePathname() ?? routes.clients;
  const labels = useTableLabels();
  const [selected, setSelected] = useState<string[]>([]);
  const href = hrefOf(organize);
  const view = useMemo(() => clientsView(clients, query), [clients, query]);
  const columns = useMemo(() => clientColumns({ say, locale, timeZone, routes, tagsByClient }), [say, locale, timeZone, routes, tagsByClient]);
  const exportSelection = () => {
    const rows = view.rows.filter((r) => selected.includes(r.id));
    const csv = dataTableCsv(rows, [
      { id: "client", header: say("clients.columns.client"), value: (c) => c.fullName },
      { id: "email", header: say("clients.columns.email"), value: (c) => c.email ?? "" },
      { id: "owed", header: say("clients.columns.owed"), value: (c) => formatMoney(c.owedCents, locale) },
    ]);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: say("clients.exportFile") });
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="flex flex-col gap-5">
      <section aria-label={say("clients.strip.label")} className="grid gap-4 rounded-xl border border-border-default bg-surface-1 p-4 sm:grid-cols-[auto_auto_minmax(12rem,1fr)] sm:items-center sm:gap-8">
        <p className="text-sm text-fg-secondary">
          <span className="block text-xl font-bold tabular-nums text-fg">{say("clients.strip.count", { count: view.strip.count })}</span>
        </p>
        <p className="text-sm text-fg-secondary">
          {say("clients.strip.owedLabel")}
          <span className="block text-xl font-bold tabular-nums text-fg">{formatMoney(view.strip.owedCents, locale)}</span>
        </p>
        <div className="flex flex-col gap-1">
          <p className="text-sm text-fg-secondary">{say("clients.strip.upToDate", { count: view.strip.upToDate, total: view.strip.count })}</p>
          <p className="text-xs text-fg-secondary">{say("clients.strip.upToDateHint")}</p>
          <Meter label={say("clients.strip.upToDate", { count: view.strip.upToDate, total: view.strip.count })} value={view.strip.upToDate} max={Math.max(view.strip.count, 1)} valueText={say("clients.strip.upToDate", { count: view.strip.upToDate, total: view.strip.count })} />
        </div>
      </section>
      <TagBinder organize={organize} path={pathname} own={{ q: query.q || undefined, filter: query.filter === "all" ? undefined : query.filter }} />
      <ViewsBar organize={organize} path={pathname} own={{ q: query.q || undefined, filter: query.filter === "all" ? undefined : query.filter }} />
      <div className="flex flex-col gap-3">
        <SearchField label={say("clients.search")} placeholder={say("clients.searchPlaceholder")} defaultValue={query.q} debounce={250} onSearch={(q) => router.replace(href(pathname, { ...query, q: q.trim() }), { scroll: false })} clearLabel={say("clients.clear")} shortcut={false} />
        <ul className="flex flex-wrap gap-2" aria-label={say("clients.filters")}>
          {CLIENT_FILTERS.map((f) => (
            <li key={f}>
              <ChipLink selected={f === query.filter} asChild>
                <Link href={href(pathname, { ...query, filter: f })} scroll={false}>
                  {say(`clients.filter.${f}`)} <span className="tabular-nums">{view.counts[f]}</span>
                </Link>
              </ChipLink>
            </li>
          ))}
        </ul>
      </div>
      <DataTable
        caption={say("clients.caption")}
        rows={view.rows}
        columns={columns}
        labels={labels}
        getRowId={(c) => c.id}
        rowLabel={(c) => c.fullName}
        selectable
        selected={selected}
        onSelectedChange={setSelected}
        bulkMax={200}
        bulkActions={bulkActions({ organize, selected, onExport: exportSelection, exportLabel: say("clients.selection.export") })}
        defaultSort={{ column: "client", direction: "ascending" }}
        empty={<EmptyState icon={<Mascot bird="beaver" mood="thinking" size={120} />} title={say("clients.noMatch")} action={<ButtonLink href={href(pathname, { q: "", filter: "all" })} variant="secondary" size="sm">{say("clients.clear")}</ButtonLink>} />}
      />
    </div>
  );
}

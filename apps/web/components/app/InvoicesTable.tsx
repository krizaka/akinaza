"use client";

import { Badge } from "@krizaka/ui/badge";
import { DataTable, type DataTableColumn } from "@krizaka/ui/data-table";
import Link from "next/link";
import { useMemo } from "react";

import { formatDate, formatMoney } from "@/lib/format";
import { useSay } from "@/lib/i18n-client";

export interface InvoiceRowView {
  id: string;
  number: string;
  client: string | null;
  issuedOn: string;
  dueOn: string | null;
  language: "fr" | "en";
  creditOf: string | null;
  totalCents: number;
}

/** The issued invoices on the DataTable: number (opens the document), client, dates, total; a card per invoice on a phone. */
export function InvoicesTable({ invoices }: { invoices: InvoiceRowView[] }) {
  const { say, locale } = useSay();
  const columns = useMemo<DataTableColumn<InvoiceRowView>[]>(() => {
    const day = (d: string) => formatDate(`${d}T12:00:00Z`, locale, "UTC");
    return [
      {
        id: "number",
        header: say("invoices.table.number"),
        type: "title",
        card: "title",
        sortable: true,
        value: (i) => i.number,
        cell: (i) => (
          <Link className="font-mono font-semibold text-fg-accent underline" href={`/${locale}/app/invoices/${i.id}`} aria-label={say("invoices.list.open", { number: i.number })}>
            {i.number}
          </Link>
        ),
        subtitle: (i) => (i.creditOf ? say("invoices.list.credit") : i.language.toUpperCase()),
      },
      { id: "client", header: say("invoices.table.client"), sortable: true, filter: "text", value: (i) => i.client ?? "", cell: (i) => i.client ?? say("invoices.list.noClient") },
      { id: "issued", header: say("invoices.table.issued"), sortable: true, priority: 2, value: (i) => i.issuedOn, cell: (i) => day(i.issuedOn) },
      { id: "due", header: say("invoices.table.due"), priority: 3, value: (i) => i.dueOn ?? "", cell: (i) => (i.dueOn ? day(i.dueOn) : "—") },
      { id: "kind", header: say("invoices.table.kind"), type: "status", priority: 3, value: (i) => (i.creditOf ? "credit" : "invoice"), cell: (i) => (i.creditOf ? <Badge tone="warning">{say("invoices.list.credit")}</Badge> : null) },
      { id: "total", header: say("invoices.table.total"), type: "number", sortable: true, value: (i) => i.totalCents, cell: (i) => formatMoney(i.totalCents, locale) },
    ];
  }, [say, locale]);
  return <DataTable caption={say("invoices.list.title")} rows={invoices} columns={columns} getRowId={(i) => i.id} rowLabel={(i) => i.number} defaultSort={{ column: "issued", direction: "descending" }} />;
}

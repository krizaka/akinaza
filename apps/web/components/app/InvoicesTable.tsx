"use client";

import { INVOICE_STATE, invoiceState, remainingCents } from "@akinaza/core";
import { Alert } from "@krizaka/ui/alert";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { DataTable, type DataTableColumn, DataTableColumnsMenu, DataTableExport, DataTableFilters } from "@krizaka/ui/data-table";
import Link from "next/link";
import { useMemo } from "react";

import { InvoiceSendAction } from "@/components/app/InvoiceSendAction";
import { useShopRoutes } from "@/components/app/ShopSession";
import { useCall } from "@/components/app/useCall";
import { ButtonLink } from "@/components/ButtonLink";
import { formatDate, formatMoney } from "@/lib/format";
import { useSay } from "@/lib/i18n-client";
import { STATE_TONE } from "@/lib/invoice-tone";
import { useTableLabels } from "@/lib/table-labels";

export interface InvoiceRowView {
  id: string;
  number: string;
  client: string | null;
  clientId?: string | null;
  clientEmail?: string | null;
  issuedOn: string;
  dueOn: string | null;
  language: "fr" | "en";
  creditOf: string | null;
  subtotalCents: number;
  gstCents: number;
  qstCents: number;
  totalCents: number;
  paidCents: number;
  /** A credit note cancelled it, or a correction replaced it (#207). */
  superseded: boolean;
}

const standing = (i: InvoiceRowView) => ({ totalCents: i.totalCents, paidCents: i.paidCents, dueOn: i.dueOn, isCredit: !!i.creditOf, superseded: i.superseded });

/** The order of the list (D2): the overdue first — what to chase —, then the newest. */
export function byUrgency<T extends InvoiceRowView>(invoices: readonly T[], today: string): T[] {
  const overdue = (i: T) => (invoiceState(standing(i), today) === INVOICE_STATE.overdue ? 0 : 1);
  return [...invoices].sort((a, b) => overdue(a) - overdue(b) || b.issuedOn.localeCompare(a.issuedOn) || b.number.localeCompare(a.number));
}

/** The ways a balance is cashed in one tap from the list (the invoice page records any other). */
const QUICK_METHODS = ["cash", "card", "transfer"] as const;

/**
 * The issued invoices (akinaza#218, D2): in the screen's words (`useTableLabels`), the number narrow and the client wide, the
 * state derived from the ledger (`invoiceState`) as a chip with its tone, the overdue first; searched by number and client,
 * filtered by state, exported as CSV, each unfolding its amounts and its quick actions — open, edit (#207), cash the balance.
 * A card per invoice on a phone.
 */
export function InvoicesTable({ invoices, today, defaultMessage = "" }: { invoices: InvoiceRowView[]; today: string; defaultMessage?: string }) {
  const { say, locale } = useSay();
  const routes = useShopRoutes();
  const call = useCall();
  const labels = useTableLabels();
  const ordered = useMemo(() => byUrgency(invoices, today), [invoices, today]);
  const columns = useMemo<DataTableColumn<InvoiceRowView>[]>(() => {
    const day = (d: string) => formatDate(`${d}T12:00:00Z`, locale, "UTC");
    return [
      {
        id: "number",
        header: say("invoices.table.number"),
        type: "title",
        card: "title",
        width: 132,
        sortable: true,
        filter: "text",
        value: (i) => i.number,
        cell: (i) => (
          <Link className="font-mono font-semibold text-fg-accent underline" href={routes.invoice(i.id)} aria-label={say("invoices.list.open", { number: i.number })}>
            {i.number}
          </Link>
        ),
        subtitle: (i) => (i.creditOf ? say("invoices.list.credit") : i.language.toUpperCase()),
      },
      { id: "client", header: say("invoices.table.client"), sortable: true, filter: "text", minWidth: 240, value: (i) => i.client ?? "", cell: (i) => i.client ?? say("invoices.list.noClient") },
      {
        id: "state",
        header: say("invoices.table.state"),
        type: "status",
        filter: "facet",
        options: Object.values(INVOICE_STATE).map((s) => ({ value: s, label: say(`invoices.state.${s}`) })),
        value: (i) => invoiceState(standing(i), today),
        cell: (i) => {
          const state = invoiceState(standing(i), today);
          return (
            <Badge tone={STATE_TONE[state]} data-invoice={i.id} data-state={state}>
              {say(`invoices.state.${state}`)}
            </Badge>
          );
        },
      },
      { id: "issued", header: say("invoices.table.issued"), sortable: true, priority: 2, value: (i) => i.issuedOn, cell: (i) => day(i.issuedOn) },
      { id: "due", header: say("invoices.table.due"), priority: 3, hideable: true, value: (i) => i.dueOn ?? "", cell: (i) => (i.dueOn ? day(i.dueOn) : "—") },
      { id: "total", header: say("invoices.table.total"), type: "number", sortable: true, value: (i) => i.totalCents, cell: (i) => formatMoney(i.totalCents, locale) },
      { id: "remaining", header: say("invoices.table.remaining"), type: "number", sortable: true, priority: 3, hideable: true, value: (i) => remainingCents(standing(i)), cell: (i) => formatMoney(remainingCents(standing(i)), locale) },
    ];
  }, [say, locale, routes, today]);

  const detail = (i: InvoiceRowView) => {
    const state = invoiceState(standing(i), today);
    const left = remainingCents(standing(i));
    const amounts: [string, number][] = [
      [say("invoices.detail.subtotal"), i.subtotalCents],
      [say("invoices.detail.gst"), i.gstCents],
      [say("invoices.detail.qst"), i.qstCents],
      [say("invoices.detail.total"), i.totalCents],
      [say("invoices.detail.paid"), i.paidCents],
      [say("invoices.detail.remaining"), left],
    ];
    return (
      <div className="flex flex-col gap-3 p-2">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
          {amounts.map(([term, cents]) => (
            <div key={term} className="flex justify-between gap-3">
              <dt className="text-fg-secondary">{term}</dt>
              <dd className="tabular-nums text-fg">{formatMoney(cents, locale)}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-2">
          {i.clientId && i.clientEmail ? <InvoiceSendAction invoiceId={i.id} email={i.clientEmail} defaultMessage={defaultMessage} /> : null}
          <ButtonLink href={routes.invoice(i.id)} variant="secondary" size="sm">
            {say("invoices.detail.open")}
          </ButtonLink>
          {state !== INVOICE_STATE.credit && state !== INVOICE_STATE.cancelled ? (
            <ButtonLink href={routes.invoiceCorrect(i.id)} variant="ghost" size="sm">
              {say("invoices.detail.edit")}
            </ButtonLink>
          ) : null}
          {left > 0
            ? QUICK_METHODS.map((method) => (
                <Button key={method} size="sm" variant="ghost" disabled={call.pending} onClick={() => call.run(`/api/walker/invoices/${i.id}/payments`, { json: { method, amountCents: left } })}>
                  {say("invoices.detail.cash", { method: say(`invoices.methods.${method}`), amount: formatMoney(left, locale) })}
                </Button>
              ))
            : null}
        </div>
        {call.problem ? <Alert tone="danger">{call.problem}</Alert> : null}
      </div>
    );
  };

  return (
    <DataTable
      caption={say("invoices.list.title")}
      rows={ordered}
      columns={columns}
      labels={labels}
      density="compact"
      getRowId={(i) => i.id}
      rowLabel={(i) => i.number}
      renderDetail={detail}
      toolbar={
        <div className="flex flex-col gap-3">
          <DataTableFilters />
          <div className="flex justify-end gap-2">
            <DataTableColumnsMenu />
            <DataTableExport filename={say("invoices.list.exportFile", { day: today })} />
          </div>
        </div>
      }
    />
  );
}

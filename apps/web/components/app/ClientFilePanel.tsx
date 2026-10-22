"use client";

import type { ClientFile } from "@akinaza/db";
import { Badge } from "@krizaka/ui/badge";
import { DataTable, type DataTableColumn } from "@krizaka/ui/data-table";
import { Stat, StatGrid } from "@krizaka/ui/stat";
import Link from "next/link";
import { useMemo } from "react";

import { ClientAvatar } from "@/components/app/ClientsTable";
import { AccessNotesFor, DependantsList } from "@/components/app/DependantsList";
import { useShopRoutes } from "@/components/app/ShopSession";
import { AppointmentStatus, STATUS_TONE } from "@/lib/day";
import { formatDate, formatMoney, formatTime } from "@/lib/format";
import { useSay } from "@/lib/i18n-client";

type Visit = ClientFile["visits"][number];
type Bill = ClientFile["invoices"][number];

export interface ClientFilePanelProps {
  file: ClientFile;
  timeZone: string;
  /** The server's clock: « next » and « last » are the same on both sides of the page. */
  nowIso: string;
}

/** A client's file: who they are, four figures, then their visits, their invoices, their notes. */
export function ClientFilePanel({ file, timeZone, nowIso }: ClientFilePanelProps) {
  const { say, locale } = useSay();
  const routes = useShopRoutes();
  const { client } = file;
  const now = Date.parse(nowIso);
  const began = file.visits.filter((v) => v.status !== AppointmentStatus.Cancelled && v.status !== AppointmentStatus.NoShow && Date.parse(v.startsAt) <= now);
  const upcoming = file.visits.filter((v) => v.status === AppointmentStatus.Booked && Date.parse(v.startsAt) > now);
  const last = began[0];
  const next = upcoming.at(-1);
  const spent = file.invoices.reduce((sum, i) => sum + i.totalCents, 0);
  const day = (iso: string | undefined) => (iso ? formatDate(iso, locale, timeZone) : say("clients.never"));

  const visitColumns = useMemo<DataTableColumn<Visit>[]>(
    () => [
      { id: "date", header: say("clients.file.date"), type: "title", card: "title", sortable: true, value: (v) => v.startsAt, cell: (v) => `${formatDate(v.startsAt, locale, timeZone)} · ${formatTime(v.startsAt, locale, timeZone)}` },
      { id: "service", header: say("clients.file.service"), value: (v) => v.service[locale] },
      { id: "staff", header: say("clients.file.with"), priority: 2, value: (v) => v.staff },
      { id: "status", header: say("clients.file.status"), type: "status", value: (v) => v.status, cell: (v) => <Badge tone={STATUS_TONE[v.status]}>{say(`today.statuses.${v.status}`)}</Badge> },
      { id: "price", header: say("clients.file.price"), type: "number", priority: 2, value: (v) => v.priceCents, cell: (v) => formatMoney(v.priceCents, locale) },
    ],
    [say, locale, timeZone],
  );
  const billColumns = useMemo<DataTableColumn<Bill>[]>(
    () => [
      {
        id: "number",
        header: say("clients.file.number"),
        type: "title",
        card: "title",
        value: (i) => i.number,
        cell: (i) => (
          <Link href={routes.invoice(i.id)} className="font-mono font-semibold text-fg-accent underline">
            {i.number}
          </Link>
        ),
      },
      { id: "date", header: say("clients.file.date"), sortable: true, value: (i) => i.issuedOn, cell: (i) => formatDate(`${i.issuedOn}T12:00:00Z`, locale, "UTC") },
      { id: "kind", header: say("clients.file.status"), type: "status", value: (i) => (i.creditOf ? "credit" : "invoice"), cell: (i) => (i.creditOf ? <Badge tone="warning">{say("clients.file.credit")}</Badge> : null) },
      { id: "total", header: say("clients.file.total"), type: "number", value: (i) => i.totalCents, cell: (i) => formatMoney(i.totalCents, locale) },
    ],
    [say, locale, routes],
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-4">
        <ClientAvatar name={client.fullName} size="lg" />
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-bold text-fg">{client.fullName}</h1>
          <p className="text-sm text-fg-secondary">
            {client.phone ? (
              <a className="text-fg-accent underline" href={`tel:${client.phone.replace(/[^0-9+]/g, "")}`}>
                {client.phone}
              </a>
            ) : null}
            {client.phone && client.email ? " · " : ""}
            {client.email ? (
              <a className="text-fg-accent underline" href={`mailto:${client.email}`}>
                {client.email}
              </a>
            ) : null}
          </p>
          <p className="text-xs text-fg-muted">{say("clients.file.since", { date: formatDate(client.since, locale, timeZone) })}</p>
        </div>
      </header>

      <StatGrid>
        <Stat label={say("clients.columns.visits")} value={began.length} />
        <Stat label={say("clients.columns.spent")} value={formatMoney(spent, locale)} />
        <Stat label={say("clients.columns.last")} value={day(last?.startsAt)} />
        <Stat label={say("clients.columns.next")} value={day(next?.startsAt)} />
      </StatGrid>

      <section aria-labelledby="client-visits" className="flex flex-col gap-3">
        <h2 id="client-visits" className="font-display text-lg font-bold text-fg">
          {say("clients.file.visits")}
        </h2>
        {file.visits.length === 0 ? (
          <p className="text-fg-secondary">{say("clients.file.noVisits")}</p>
        ) : (
          <DataTable caption={say("clients.file.visits")} rows={file.visits} columns={visitColumns} getRowId={(v) => v.id} rowLabel={(v) => formatDate(v.startsAt, locale, timeZone)} defaultSort={{ column: "date", direction: "descending" }} />
        )}
      </section>

      <section aria-labelledby="client-invoices" className="flex flex-col gap-3">
        <h2 id="client-invoices" className="font-display text-lg font-bold text-fg">
          {say("clients.file.invoices")}
        </h2>
        {file.invoices.length === 0 ? (
          <p className="text-fg-secondary">{say("clients.file.noInvoices")}</p>
        ) : (
          <DataTable caption={say("clients.file.invoices")} rows={file.invoices} columns={billColumns} getRowId={(i) => i.id} rowLabel={(i) => i.number} />
        )}
      </section>

      <section aria-labelledby="client-notes" className="flex flex-col gap-3">
        <h2 id="client-notes" className="font-display text-lg font-bold text-fg">
          {say("clients.file.notes")}
        </h2>
        <p className="whitespace-pre-line text-fg-secondary">{client.notes ?? say("clients.file.noNotes")}</p>
        <AccessNotesFor clientId={client.id} clientName={client.fullName} present={client.hasAccessNotes} />
        <DependantsList dependants={file.dependants} />
      </section>
    </div>
  );
}

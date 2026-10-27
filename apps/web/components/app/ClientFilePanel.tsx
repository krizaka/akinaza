"use client";

import { invoiceState, remainingCents } from "@akinaza/core";
import type { ClientFile, ClientNote } from "@akinaza/db";
import { Badge } from "@krizaka/ui/badge";
import { DataTable, type DataTableColumn } from "@krizaka/ui/data-table";
import { DetailLayout } from "@krizaka/ui/detail-layout";
import { Stat, StatGrid } from "@krizaka/ui/stat";
import { Tabs } from "@krizaka/ui/tabs";
import Link from "next/link";
import { useMemo } from "react";

import { ClientNotes } from "@/components/app/ClientNotes";
import { ClientAvatar } from "@/components/app/ClientsTable";
import { AccessNotesFor, DependantsList } from "@/components/app/DependantsList";
import { TagChips, TagsEditor } from "@/components/app/organize";
import { useShopRoutes } from "@/components/app/ShopSession";
import { ButtonLink } from "@/components/ButtonLink";
import { CLIENT_FILE_TABS, type ClientFileTab } from "@/lib/clients-view";
import { AppointmentStatus, STATUS_TONE } from "@/lib/day";
import { formatDate, formatMoney, formatTime } from "@/lib/format";
import { useSay } from "@/lib/i18n-client";
import { STATE_TONE } from "@/lib/invoice-tone";
import type { OrganizeData, TagLite } from "@/lib/organize-view";
import { useTableLabels } from "@/lib/table-labels";

type Visit = ClientFile["visits"][number];
type Bill = ClientFile["invoices"][number];

export interface ClientFilePanelProps {
  file: ClientFile;
  timeZone: string;
  /** The server's clock: « next » and « last » are the same on both sides of the page. */
  nowIso: string;
  /** The role may issue invoices: « Facturer ce client » opens « Nouvelle facture » with this client chosen (D3). */
  mayInvoice?: boolean;
  /** The signed notes, newest first (D5). */
  notes: ClientNote[];
  /** The binder's section in the address (`?tab=`). */
  tab: ClientFileTab;
  /** The shop's calendar day: an invoice's derived state (`invoiceState`). */
  today: string;
  /** The shop's tags and who may write them (akinaza#337), and the ones this client wears. */
  organize?: OrganizeData;
  tags?: TagLite[];
}


/**
 * A client's file on Show · detail (D5, review K3b): the name as the page's `h1` with the avatar and the state (what they still
 * owe) on the profile banner (krizaka-ui#650), the contact and the client's tags on one line, « Facturer ce client »; the binder's dividers
 * in the address (Résumé · Factures · Visites · Notes, `Tabs.Nav variant="binder"`, krizaka-ui#648); the signed notes in the side column (under the content on a phone). Each invoice wears the list's state.
 */
const standing = (i: Bill) => ({ totalCents: i.totalCents, paidCents: i.paidCents, dueOn: i.dueOn, isCredit: i.creditOf !== null, superseded: i.superseded });

/** The count a tab wears on the binder's divider: the lists have one, the summary none. */
function tabCount(t: ClientFileTab, counts: { invoices: number; visits: number; notes: number }): number | undefined {
  if (t === "invoices" || t === "visits" || t === "notes") return counts[t];
  return undefined;
}

/** A list of the file under its heading: the table, or the sentence saying there is nothing yet. */
function ListSection({ id, title, empty, children }: { id: string; title: string; empty: string | null; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-lg font-semibold text-fg">{title}</h2>
      {empty === null ? children : <p className="text-fg-secondary">{empty}</p>}
    </section>
  );
}

/** The visits that took place (not cancelled, not missed, started), the latest of them, and the next booked one. */
function visitSummary(visits: Visit[], now: number) {
  const began = visits.filter((v) => v.status !== AppointmentStatus.Cancelled && v.status !== AppointmentStatus.NoShow && Date.parse(v.startsAt) <= now);
  const upcoming = visits.filter((v) => v.status === AppointmentStatus.Booked && Date.parse(v.startsAt) > now);
  return { began, last: began[0], next: upcoming.at(-1) };
}

/** The line under the name: phone, e-mail, since when, and the client's tags with their editor for who may organise. */
function ClientMeta({ client, timeZone, tags, organize }: { client: ClientFilePanelProps["file"]["client"]; timeZone: string; tags: NonNullable<ClientFilePanelProps["tags"]>; organize: ClientFilePanelProps["organize"] }) {
  const { say, locale } = useSay();
  const parts = [
    client.phone ? (
      <a key="phone" className="text-fg-accent underline" href={`tel:${client.phone.replace(/[^0-9+]/g, "")}`}>
        {client.phone}
      </a>
    ) : null,
    client.email ? (
      <a key="email" className="break-all text-fg-accent underline" href={`mailto:${client.email}`}>
        {client.email}
      </a>
    ) : null,
    <span key="since" className="whitespace-nowrap">{say("clients.file.since", { date: formatDate(client.since, locale, timeZone) })}</span>,
  ].filter(Boolean);
  const showsTags = tags.length > 0 || organize?.canWrite;
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-secondary">
      {parts.map((part, n) => (
        <span key={n} className="flex items-center gap-2">
          {n > 0 ? <span aria-hidden>·</span> : null}
          {part}
        </span>
      ))}
      {showsTags ? (
        <span className="flex flex-wrap items-center gap-2" aria-label={say("organize.file.tags")}>
          <TagChips tags={tags} />
          {organize ? <TagsEditor organize={organize} entityId={client.id} worn={tags} /> : null}
        </span>
      ) : null}
    </span>
  );
}

export function ClientFilePanel({ file, timeZone, nowIso, mayInvoice = false, notes, tab, today, organize, tags = [] }: ClientFilePanelProps) {
  const { say, locale } = useSay();
  const routes = useShopRoutes();
  const labels = useTableLabels();
  const { client } = file;
  const { began, last, next } = visitSummary(file.visits, Date.parse(nowIso));
  const spent = file.invoices.reduce((sum, i) => sum + i.totalCents, 0);
  const owed = file.invoices.reduce((n, i) => n + remainingCents(standing(i)), 0);
  const tabHref = (t: ClientFileTab) => (t === "summary" ? routes.client(client.id) : `${routes.client(client.id)}?tab=${t}`);
  const day = (iso: string | undefined) => (iso ? formatDate(iso, locale, timeZone) : say("clients.never"));

  const visitColumns = useMemo<DataTableColumn<Visit>[]>(
    () => [
      { id: "date", header: say("clients.file.date"), type: "title", card: "title", sortable: true, value: (v) => v.startsAt, cell: (v) => <span className="whitespace-nowrap">{`${formatDate(v.startsAt, locale, timeZone)} · ${formatTime(v.startsAt, locale, timeZone)}`}</span> },
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
      { id: "date", header: say("clients.file.date"), sortable: true, value: (i) => i.issuedOn, cell: (i) => <span className="whitespace-nowrap">{formatDate(`${i.issuedOn}T12:00:00Z`, locale, "UTC")}</span> },
      {
        id: "state",
        header: say("clients.file.status"),
        type: "status",
        value: (i) => invoiceState(standing(i), today),
        cell: (i) => {
          const state = invoiceState(standing(i), today);
          return (
            <Badge tone={STATE_TONE[state]} data-state={state}>
              {say(`invoices.state.${state}`)}
            </Badge>
          );
        },
      },
      { id: "total", header: say("clients.file.total"), type: "number", value: (i) => i.totalCents, cell: (i) => formatMoney(i.totalCents, locale) },
    ],
    [say, locale, routes, today],
  );

  const notesColumn = <ClientNotes clientId={client.id} notes={notes} timeZone={timeZone} />;
  return (
    <DetailLayout
      cover
      eyebrow={say("clients.file.eyebrow")}
      media={<ClientAvatar name={client.fullName} size="lg" />}
      title={client.fullName}
      status={owed > 0 ? <Badge tone="warning">{say("clients.state.owes", { amount: formatMoney(owed, locale) })}</Badge> : <Badge tone="success">{say("clients.state.upToDate")}</Badge>}
      meta={<ClientMeta client={client} timeZone={timeZone} tags={tags} organize={organize} />}
      actions={
        mayInvoice ? (
          <ButtonLink href={routes.newInvoiceFor({ client: client.id })} variant="secondary" size="md">
            {say("clients.file.bill")}
          </ButtonLink>
        ) : null
      }
      tabs={
        <Tabs.Nav label={say("clients.file.sections")} variant="binder" current={tabHref(tab)}>
          {CLIENT_FILE_TABS.map((t) => (
            <Tabs.NavLink key={t} href={tabHref(t)} exact hue={t === "summary" ? "accent" : "neutral"} count={tabCount(t, { invoices: file.invoices.length, visits: file.visits.length, notes: notes.length })}>
              {say(`clients.file.tabs.${t}`)}
            </Tabs.NavLink>
          ))}
        </Tabs.Nav>
      }
      aside={tab === "notes" ? undefined : notesColumn}
    >
      {tab === "summary" ? (
        <div className="flex flex-col gap-6">
          <StatGrid>
            <Stat label={say("clients.columns.visits")} value={began.length} />
            <Stat label={say("clients.columns.spent")} value={formatMoney(spent, locale)} />
            <Stat label={say("clients.columns.last")} value={day(last?.startsAt)} />
            <Stat label={say("clients.columns.next")} value={day(next?.startsAt)} />
          </StatGrid>
          {client.notes ? <p className="whitespace-pre-line text-fg-secondary">{client.notes}</p> : null}
          <AccessNotesFor clientId={client.id} clientName={client.fullName} present={client.hasAccessNotes} />
          <DependantsList dependants={file.dependants} />
        </div>
      ) : null}
      {tab === "invoices" ? (
        <ListSection id="client-invoices" title={say("clients.file.invoices")} empty={file.invoices.length === 0 ? say("clients.file.noInvoices") : null}>
          <DataTable caption={say("clients.file.invoices")} rows={file.invoices} columns={billColumns} labels={labels} getRowId={(i) => i.id} rowLabel={(i) => i.number} />
        </ListSection>
      ) : null}
      {tab === "visits" ? (
        <ListSection id="client-visits" title={say("clients.file.visits")} empty={file.visits.length === 0 ? say("clients.file.noVisits") : null}>
          <DataTable caption={say("clients.file.visits")} rows={file.visits} columns={visitColumns} labels={labels} getRowId={(v) => v.id} rowLabel={(v) => formatDate(v.startsAt, locale, timeZone)} defaultSort={{ column: "date", direction: "descending" }} />
        </ListSection>
      ) : null}
      {tab === "notes" ? notesColumn : null}
    </DetailLayout>
  );
}

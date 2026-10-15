"use client";

import { Badge } from "@krizaka/ui/badge";
import { DataTable, type DataTableColumn,DataTableColumnsMenu, DataTableExport, DataTableFilters } from "@krizaka/ui/data-table";
import Link from "next/link";
import { useMemo } from "react";

import type { AdminUser, AuditEntry } from "@/lib/admin";
import type { AdminInvoice, AdminShop, LedgerCheck } from "@/lib/admin-content";
import { useSay } from "@/lib/i18n-client";

import { formatDate, formatMoney } from "./format";

const toolbar = (filename: string) => (
  <div className="flex flex-col gap-3">
    <DataTableFilters />
    <div className="flex justify-end gap-2">
      <DataTableColumnsMenu />
      <DataTableExport filename={filename} />
    </div>
  </div>
);

/** The accounts: who, role, state, memberships, last seen; searchable, filterable, exportable. */
export function UsersTable({ users }: { users: AdminUser[] }) {
  const { say, locale } = useSay();
  const columns = useMemo<DataTableColumn<AdminUser>[]>(
    () => [
      { id: "email", header: say("admin.columns.email"), sortable: true, filter: "text", card: "title", cell: (u) => <Link className="font-semibold text-fg hover:text-fg-accent hover:underline" href={`/${locale}/users/${u.id}`}>{u.email}</Link> },
      { id: "role", header: say("admin.columns.role"), filter: "facet", cell: (u) => <Badge tone={u.role === "ADMIN" ? "accent" : "neutral"}>{say(`admin.roles.${u.role}`)}</Badge> },
      { id: "status", header: say("admin.columns.status"), filter: "facet", cell: (u) => <Badge tone={u.status === "ACTIVE" ? "success" : "danger"}>{say(`admin.states.${u.status}`)}</Badge> },
      { id: "shops", header: say("admin.columns.shops"), sortable: true, align: "end" },
      { id: "lastSeenAt", header: say("admin.columns.lastSeen"), sortable: true, align: "end", value: (u) => u.lastSeenAt ?? "", cell: (u) => (u.lastSeenAt ? formatDate(u.lastSeenAt, locale, true) : say("admin.never")) },
    ],
    [say, locale],
  );
  return <DataTable caption={say("admin.users.caption")} rows={users} columns={columns} getRowId={(u) => u.id} rowLabel={(u) => u.email} defaultPageSize={25} defaultSort={{ column: "lastSeenAt", direction: "descending" }} toolbar={toolbar("akinaza-users.csv")} />;
}

export function ShopsTable({ shops }: { shops: AdminShop[] }) {
  const { say, locale } = useSay();
  const columns = useMemo<DataTableColumn<AdminShop>[]>(
    () => [
      { id: "name", header: say("admin.columns.shop"), sortable: true, filter: "text", card: "title" },
      { id: "kind", header: say("admin.columns.kind"), filter: "facet", cell: (s) => say(`admin.kinds.${s.kind}`) },
      { id: "registrant", header: say("admin.columns.registrant"), filter: "facet", value: (s) => (s.registrant ? "yes" : "no"), cell: (s) => <Badge tone={s.registrant ? "success" : "neutral"}>{say(s.registrant ? "admin.yes" : "admin.no")}</Badge> },
      { id: "owner", header: say("admin.columns.owner"), value: (s) => s.owner ?? "", cell: (s) => s.owner ?? say("admin.never") },
      { id: "clients", header: say("admin.columns.clients"), sortable: true, align: "end" },
      { id: "invoices", header: say("admin.columns.invoices"), sortable: true, align: "end" },
      { id: "lastInvoiceOn", header: say("admin.columns.lastInvoice"), sortable: true, value: (s) => s.lastInvoiceOn ?? "", cell: (s) => (s.lastInvoiceOn ? formatDate(s.lastInvoiceOn, locale) : say("admin.never")) },
    ],
    [say, locale],
  );
  return <DataTable caption={say("admin.shops.caption")} rows={shops} columns={columns} getRowId={(s) => s.id} defaultPageSize={25} toolbar={toolbar("akinaza-shops.csv")} />;
}

/** Invoices with their taxes and what the ledger holds for each: a difference is shown in red. */
export function InvoicesTable({ invoices }: { invoices: AdminInvoice[] }) {
  const { say, locale } = useSay();
  const columns = useMemo<DataTableColumn<AdminInvoice>[]>(
    () => [
      { id: "number", header: say("admin.columns.number"), sortable: true, filter: "text", card: "title", cell: (i) => <span className="font-mono text-xs">{i.number}</span> },
      { id: "shop", header: say("admin.columns.shop"), filter: "facet" },
      { id: "issuedOn", header: say("admin.columns.issued"), sortable: true, cell: (i) => formatDate(i.issuedOn, locale) },
      { id: "isCredit", header: say("admin.columns.kind"), filter: "facet", value: (i) => (i.isCredit ? "credit" : "invoice"), cell: (i) => (i.isCredit ? <Badge tone="warning">{say("admin.creditNote")}</Badge> : say("admin.invoice")) },
      { id: "subtotalCents", header: say("admin.columns.subtotal"), sortable: true, align: "end", cell: (i) => formatMoney(i.subtotalCents, locale) },
      { id: "gstCents", header: say("admin.columns.gst"), sortable: true, align: "end", cell: (i) => formatMoney(i.gstCents, locale) },
      { id: "qstCents", header: say("admin.columns.qst"), sortable: true, align: "end", cell: (i) => formatMoney(i.qstCents, locale) },
      { id: "totalCents", header: say("admin.columns.total"), sortable: true, align: "end", cell: (i) => formatMoney(i.totalCents, locale) },
      { id: "ledgerOk", header: say("admin.columns.ledger"), filter: "facet", value: (i) => (i.ledgerOk ? "agrees" : "differs"), cell: (i) => <Badge tone={i.ledgerOk ? "success" : "danger"}>{say(i.ledgerOk ? "admin.agrees" : "admin.differs")}</Badge> },
    ],
    [say, locale],
  );
  return <DataTable caption={say("admin.invoices.caption")} rows={invoices} columns={columns} getRowId={(i) => i.id} defaultPageSize={25} defaultSort={{ column: "issuedOn", direction: "descending" }} toolbar={toolbar("akinaza-invoices.csv")} />;
}

/** The ledger against the invoices, per shop and month. */
export function LedgerTable({ checks }: { checks: LedgerCheck[] }) {
  const { say, locale } = useSay();
  const columns = useMemo<DataTableColumn<LedgerCheck>[]>(
    () => [
      { id: "period", header: say("admin.columns.period"), sortable: true, cell: (c) => formatDate(c.period, locale) },
      { id: "shop", header: say("admin.columns.shop"), filter: "facet", card: "title" },
      { id: "gstCollectedCents", header: say("admin.columns.gstLedger"), align: "end", cell: (c) => formatMoney(c.gstCollectedCents, locale) },
      { id: "gstInvoicesCents", header: say("admin.columns.gstInvoices"), align: "end", cell: (c) => formatMoney(c.gstInvoicesCents, locale) },
      { id: "qstCollectedCents", header: say("admin.columns.qstLedger"), align: "end", cell: (c) => formatMoney(c.qstCollectedCents, locale) },
      { id: "qstInvoicesCents", header: say("admin.columns.qstInvoices"), align: "end", cell: (c) => formatMoney(c.qstInvoicesCents, locale) },
      { id: "ok", header: say("admin.columns.ledger"), filter: "facet", value: (c) => (c.ok ? "agrees" : "differs"), cell: (c) => <Badge tone={c.ok ? "success" : "danger"}>{say(c.ok ? "admin.agrees" : "admin.differs")}</Badge> },
    ],
    [say, locale],
  );
  return <DataTable caption={say("admin.ledger.caption")} rows={checks} columns={columns} getRowId={(c) => `${c.shop}-${c.period}`} defaultPageSize={25} defaultSort={{ column: "period", direction: "descending" }} toolbar={toolbar("akinaza-ledger-checks.csv")} />;
}

/** The audit log: sortable, filterable by action, exportable. */
export function AuditTable({ entries }: { entries: AuditEntry[] }) {
  const { say, locale } = useSay();
  const columns = useMemo<DataTableColumn<AuditEntry>[]>(
    () => [
      { id: "at", header: say("admin.columns.when"), sortable: true, cell: (e) => formatDate(e.at, locale, true) },
      { id: "actor", header: say("admin.columns.actor"), filter: "text" },
      { id: "action", header: say("admin.columns.action"), filter: "facet", card: "title", cell: (e) => <span className="font-mono text-xs">{e.action}</span> },
      { id: "target", header: say("admin.columns.target"), value: (e) => e.target ?? "", cell: (e) => <span className="font-mono text-[11px]">{e.target ?? "—"}</span> },
      { id: "ip", header: say("admin.columns.ip"), value: (e) => e.ip ?? "", cell: (e) => e.ip ?? "—" },
    ],
    [say, locale],
  );
  return <DataTable caption={say("admin.audit.caption")} rows={entries} columns={columns} getRowId={(e) => e.id} defaultPageSize={25} toolbar={toolbar("akinaza-audit.csv")} />;
}

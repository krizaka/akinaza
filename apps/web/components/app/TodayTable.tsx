"use client";

import { Badge } from "@krizaka/ui/badge";
import { DataTable, type DataTableColumn } from "@krizaka/ui/data-table";
import { useMemo } from "react";

import { useSay } from "@/lib/i18n-client";
import type { TodayView } from "@/lib/today";

type Row = TodayView["appointments"][number];
const TONE = { booked: "accent", done: "success", cancelled: "neutral", noShow: "warning" } as const;

/** Today's appointments, on @krizaka/ui's DataTable (a card per row on a phone). */
export function TodayTable({ rows, timeZone }: { rows: Row[]; timeZone: string }) {
  const { say, locale } = useSay();
  const columns = useMemo<DataTableColumn<Row>[]>(() => {
    const time = (iso: string) => new Date(iso).toLocaleTimeString(locale === "fr" ? "fr-CA" : "en-CA", { hour: "2-digit", minute: "2-digit", timeZone });
    return [
      { id: "time", header: say("today.table.time"), sortable: true, value: (r) => r.startsAt, cell: (r) => <span className="font-mono">{`${time(r.startsAt)}–${time(r.endsAt)}`}</span> },
      { id: "client", header: say("today.table.client"), card: "title", value: (r) => r.client ?? "", cell: (r) => r.client ?? say("today.table.walkIn") },
      { id: "service", header: say("today.table.service"), value: (r) => r.service[locale] },
      { id: "staff", header: say("today.table.staff"), value: (r) => r.staff, filter: "facet" },
      { id: "status", header: say("today.table.status"), value: (r) => r.status, cell: (r) => <Badge tone={TONE[r.status]}>{say(`today.statuses.${r.status}`)}</Badge> },
    ];
  }, [say, locale, timeZone]);
  return <DataTable caption={say("today.table.caption")} showCaption rows={rows} columns={columns} getRowId={(r) => r.id} rowLabel={(r) => r.client ?? r.service[locale]} defaultSort={{ column: "time", direction: "ascending" }} pageSize={50} />;
}

"use client";

import { Avatar } from "@krizaka/ui/avatar";
import { DataTable, type DataTableColumn } from "@krizaka/ui/data-table";
import Link from "next/link";
import { useMemo } from "react";

import { useShopRoutes } from "@/components/app/ShopSession";
import { formatDate, formatMoney } from "@/lib/format";
import { useSay } from "@/lib/i18n-client";

export interface ClientRowView {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  visits: number;
  lastVisitAt: string | null;
  nextVisitAt: string | null;
  spentCents: number;
}

/** The avatar every list of clients draws: the person's initials on the brand's gradient, the same one wherever they appear. */
export function ClientAvatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" | "lg" }) {
  return <Avatar alt="" size={size} defaultAvatar={{ brand: "akinaza", seed: name }} fallback={name.charAt(0)} />;
}

/** The shop's clients on the DataTable: who, how often, when last and next, what they spent. The name opens the file at `/app/clients/<id>`. */
export function ClientsTable({ clients, timeZone }: { clients: ClientRowView[]; timeZone: string }) {
  const { say, locale } = useSay();
  const routes = useShopRoutes();
  const columns = useMemo<DataTableColumn<ClientRowView>[]>(() => {
    const day = (iso: string | null) => (iso ? formatDate(iso, locale, timeZone) : say("clients.never"));
    return [
      {
        id: "client",
        header: say("clients.columns.client"),
        type: "title",
        card: "title",
        sortable: true,
        filter: "text",
        value: (c) => c.fullName,
        cell: (c) => (
          <Link href={routes.client(c.id)} className="flex items-center gap-3 font-semibold text-fg hover:underline">
            <ClientAvatar name={c.fullName} />
            {c.fullName}
          </Link>
        ),
        subtitle: (c) => c.email ?? c.phone ?? "",
      },
      { id: "visits", header: say("clients.columns.visits"), type: "number", sortable: true, value: (c) => c.visits },
      { id: "last", header: say("clients.columns.last"), sortable: true, priority: 2, value: (c) => c.lastVisitAt ?? "", cell: (c) => day(c.lastVisitAt) },
      { id: "next", header: say("clients.columns.next"), sortable: true, priority: 2, value: (c) => c.nextVisitAt ?? "", cell: (c) => day(c.nextVisitAt) },
      { id: "spent", header: say("clients.columns.spent"), type: "number", sortable: true, priority: 2, value: (c) => c.spentCents, cell: (c) => formatMoney(c.spentCents, locale) },
    ];
  }, [say, locale, timeZone, routes]);
  return <DataTable caption={say("clients.caption")} rows={clients} columns={columns} getRowId={(c) => c.id} rowLabel={(c) => c.fullName} defaultSort={{ column: "client", direction: "ascending" }} />;
}

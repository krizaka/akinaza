"use client";

import { Badge } from "@krizaka/ui/badge";
import { DataTable, type DataTableColumn } from "@krizaka/ui/data-table";
import { useMemo } from "react";

import { formatMoney } from "@/lib/format";
import { useSay } from "@/lib/i18n-client";

export interface BooksLineView {
  line: string;
  amountCents: number;
  computed: boolean;
  sources: { kind: "invoice" | "expense"; id: string; label: string; amountCents: number }[];
}

/**
 * The lines of the return (FPZ-500) with the figure of each and where it comes from: the invoice or the expense behind it,
 * unfolded in place. A computed line says how it is computed. A card per line on a phone.
 */
export function BooksLines({ lines }: { lines: BooksLineView[] }) {
  const { say, locale } = useSay();
  const columns = useMemo<DataTableColumn<BooksLineView>[]>(
    () => [
      { id: "line", header: say("books.table.line"), value: (r) => r.line, cell: (r) => <span className="font-mono">{r.line}</span> },
      {
        id: "label",
        header: say("books.table.label"),
        card: "title",
        value: (r) => say(`books.lines.${r.line}.label`),
        cell: (r) => (
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-fg">{say(`books.lines.${r.line}.label`)}</span>
            {r.sources.length > 0 ? (
              <details className="text-sm">
                <summary className="cursor-pointer text-fg-accent">{r.sources.length === 1 ? say("books.sourcesOne") : say("books.sources", { count: r.sources.length })}</summary>
                <ul className="mt-1 flex flex-col gap-1">
                  {r.sources.map((s) => (
                    <li key={`${s.kind}-${s.id}-${s.amountCents}`} className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <Badge tone={s.kind === "invoice" ? "accent" : "neutral"}>{say(`books.kinds.${s.kind}`)}</Badge> {s.label}
                      </span>
                      <span className="tabular-nums">{formatMoney(s.amountCents, locale)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ),
      },
      { id: "amount", header: say("books.table.amount"), align: "end", value: (r) => r.amountCents, cell: (r) => <span className="font-semibold tabular-nums">{formatMoney(r.amountCents, locale)}</span> },
    ],
    [say, locale],
  );
  return <DataTable caption={say("books.table.caption")} showCaption rows={lines} columns={columns} getRowId={(r) => r.line} rowLabel={(r) => [r.line, say(`books.lines.${r.line}.label`)].join(" ")} />;
}

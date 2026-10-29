"use client";

import { Badge } from "@krizaka/ui/badge";
import { Card } from "@krizaka/ui/card";
import { DescriptionList } from "@krizaka/ui/description-list";
import { Meter } from "@krizaka/ui/meter";

import type { Operations } from "@/lib/admin-content";
import { useSay } from "@/lib/i18n-client";
import { budgetShare } from "@/lib/operations-shared";

/** What an operator reads to know whether Akinaza is well: the database budget, and whether the tax ledger still agrees with the invoices. */
export function OperationsView({ ops }: Readonly<{ ops: Operations }>) {
  const { say } = useSay();
  const t = (key: string, vars?: Record<string, string | number>) => say(`admin.operations.${key}`, vars);
  const bad = (n: number) => <Badge tone={n > 0 ? "danger" : "success"}>{n}</Badge>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card.Root className="flex flex-col gap-3 p-4">
        <h2 className="font-display text-base font-bold text-fg">{t("database")}</h2>
        <Meter showLabel thresholds={{ low: 0.7, high: 0.9 }} label={t("pool", { busy: ops.pool.total - ops.pool.idle, open: ops.pool.total, max: ops.pool.max })} value={budgetShare(ops.pool.total - ops.pool.idle, ops.pool.max)} max={1} />
        <Meter showLabel thresholds={{ low: 0.7, high: 0.9 }} label={t("connections", { open: ops.connections.open, limit: ops.connections.limit })} value={budgetShare(ops.connections.open, ops.connections.limit)} max={1} />
        <p className="text-xs text-fg-muted">{t("waiting", { count: ops.pool.waiting })}</p>
      </Card.Root>
      <Card.Root className="flex flex-col gap-3 p-4">
        <h2 className="font-display text-base font-bold text-fg">{t("ledger")}</h2>
        <DescriptionList
          items={[
            { term: t("invoiceMismatches"), details: bad(ops.invoiceMismatches) },
            { term: t("monthMismatches"), details: bad(ops.monthMismatches) },
            { term: t("shopsWithoutTaxNumbers"), details: <Badge tone={ops.shopsWithoutTaxNumbers > 0 ? "warning" : "success"}>{ops.shopsWithoutTaxNumbers}</Badge> },
            { term: t("refusedSignIns"), details: <Badge tone={ops.refusedSignIns24h > 10 ? "warning" : "neutral"}>{ops.refusedSignIns24h}</Badge> },
          ]}
        />
      </Card.Root>
    </div>
  );
}

import { INVOICE_STATE, invoiceState } from "@akinaza/core";
import { Widget } from "@krizaka/ui/dashboard-layout";
import Link from "next/link";

import type { InvoiceRowView } from "@/components/app/InvoicesTable";
import { formatMoney } from "@/lib/format";
import { format, getDictionary, type Locale } from "@/lib/i18n";
import { shopRoutes } from "@/lib/routes";

type Invoice = Pick<InvoiceRowView, "id" | "number" | "client" | "totalCents" | "paidCents" | "dueOn" | "creditOf" | "superseded">;

/** The last invoices, as a widget of the day beside the agenda (docs/ux/2026-10-full-review.md B4): three, the overdue count, the way to all of them. */
export function TodayInvoices({ invoices, locale, shopId, today }: { invoices: Invoice[]; locale: Locale; shopId: string; today: string }) {
  if (!invoices.length) return null;
  const t = getDictionary(locale).console;
  const routes = shopRoutes(locale, shopId);
  const rows = invoices.map((invoice) => ({ ...invoice, state: invoiceState({ ...invoice, isCredit: !!invoice.creditOf }, today) }));
  const overdue = rows.filter((invoice) => invoice.state === INVOICE_STATE.overdue).length;
  return (
    <Widget
      id="today-invoices"
      title={t.today.invoices.title}
      description={format(t.today.invoices.overdue, { count: overdue })}
      action={
        <Link href={routes.invoices} className="font-semibold text-fg-accent underline">
          {t.invoices.back}
        </Link>
      }
    >
      <ul className="flex flex-col divide-y divide-border-subtle">
        {rows.slice(0, 3).map((invoice) => (
          <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 text-sm">
            <div className="min-w-0 flex-1 basis-40">
              <Link href={routes.invoice(invoice.id)} aria-label={format(t.invoices.list.open, { number: invoice.number })} className="break-words font-mono font-semibold text-fg-accent underline">
                {invoice.number}
              </Link>
              <p className="break-words text-fg-secondary">{invoice.client ?? t.invoices.list.noClient}</p>
            </div>
            <div className="flex flex-col items-end">
              <span className="tabular-nums text-fg">{formatMoney(invoice.totalCents, locale)}</span>
              <span className="text-xs text-fg-secondary">{t.invoices.state[invoice.state]}</span>
            </div>
          </li>
        ))}
      </ul>
    </Widget>
  );
}

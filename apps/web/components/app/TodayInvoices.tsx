import { INVOICE_STATE, invoiceState } from "@akinaza/core";
import { Card } from "@krizaka/ui/card";
import Link from "next/link";

import type { InvoiceRowView } from "@/components/app/InvoicesTable";
import { formatMoney } from "@/lib/format";
import { format, getDictionary, type Locale } from "@/lib/i18n";
import { shopRoutes } from "@/lib/routes";

type Invoice = Pick<InvoiceRowView, "id" | "number" | "client" | "totalCents" | "paidCents" | "dueOn" | "creditOf" | "superseded">;

export function TodayInvoices({ invoices, locale, shopId, today }: { invoices: Invoice[]; locale: Locale; shopId: string; today: string }) {
  if (!invoices.length) return null;
  const t = getDictionary(locale).console;
  const routes = shopRoutes(locale, shopId);
  const rows = invoices.map((invoice) => ({ ...invoice, state: invoiceState({ ...invoice, isCredit: !!invoice.creditOf }, today) }));
  const overdue = rows.filter((invoice) => invoice.state === INVOICE_STATE.overdue).length;
  return (
    <Card.Root asChild>
      <section aria-labelledby="today-invoices">
        <Card.Body>
          <Card.Title as="h2" id="today-invoices">{t.today.invoices.title}</Card.Title>
          <p className="text-sm text-fg-secondary">{format(t.today.invoices.overdue, { count: overdue })}</p>
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
                  <span className="font-mono tabular-nums text-fg">{formatMoney(invoice.totalCents, locale)}</span>
                  <span className="text-xs text-fg-secondary">{t.invoices.state[invoice.state]}</span>
                </div>
              </li>
            ))}
          </ul>
          <Card.Footer>
            <Link href={routes.invoices} className="font-semibold text-fg-accent underline">{t.invoices.back}</Link>
          </Card.Footer>
        </Card.Body>
      </section>
    </Card.Root>
  );
}

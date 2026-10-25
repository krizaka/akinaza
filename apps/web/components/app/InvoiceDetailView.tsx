import { invoiceState } from "@akinaza/core";
import type { invoiceDeliveryHistory } from "@akinaza/db";
import { Badge } from "@krizaka/ui/badge";
import { DetailLayout } from "@krizaka/ui/detail-layout";
import Link from "next/link";

import { InvoiceDeliveryHistory } from "@/components/app/InvoiceDeliveryHistory";
import { InvoiceDocument, type InvoiceView } from "@/components/app/InvoiceDocument";
import { InvoiceSendAction } from "@/components/app/InvoiceSendAction";
import { STATE_TONE } from "@/components/app/InvoicesTable";
import { PrintInvoiceButton } from "@/components/app/PrintInvoiceButton";
import { ButtonLink } from "@/components/ButtonLink";
import { formatDate, formatMoney } from "@/lib/format";
import { format, getDictionary, type Locale } from "@/lib/i18n";
import type { ShopRoutes } from "@/lib/routes";

export interface InvoiceDetailViewProps {
  invoice: InvoiceView;
  deliveries: Awaited<ReturnType<typeof invoiceDeliveryHistory>>;
  locale: Locale;
  routes: ShopRoutes;
  /** The shop's calendar day (`localDay`): an invoice past its due date with money owed is overdue. */
  today: string;
  /** The message the shop sends with its invoices (Boutique › invoice e-mails). */
  defaultMessage?: string;
}

/**
 * One invoice on `DetailLayout` (D2, review K3): its number is the page's `h1`, its state the list's (`invoiceState`, from what
 * the ledger received) as a chip, « Envoyer la facture » the one primary with « Modifier » and « Imprimer » beside it; the aside
 * holds the deliveries and the chain (what it replaces, what replaced or cancelled it). The document keeps its own language.
 */
export function InvoiceDetailView({ invoice, deliveries, locale, routes, today, defaultMessage }: InvoiceDetailViewProps) {
  const t = getDictionary(locale).console;
  const state = invoiceState({ totalCents: invoice.totalCents, paidCents: invoice.paidCents, dueOn: invoice.dueOn, isCredit: invoice.creditOf !== null, superseded: Boolean(invoice.replacedBy ?? invoice.creditedBy) }, today);
  // An invoice that still stands can be corrected (#207); a credit note or an already credited invoice cannot.
  const correctable = !invoice.creditOf && !invoice.creditedBy;
  const chain = [
    invoice.replaces ? { href: routes.invoice(invoice.replaces.id), text: format(t.invoices.chain.replaces, { number: invoice.replaces.number }) } : null,
    invoice.replacedBy ? { href: routes.invoice(invoice.replacedBy.id), text: format(t.invoices.chain.replacedBy, { number: invoice.replacedBy.number }) } : null,
    invoice.creditedBy && !invoice.replacedBy ? { href: routes.invoice(invoice.creditedBy.id), text: format(t.invoices.chain.creditedBy, { number: invoice.creditedBy.number }) } : null,
  ].filter((c): c is { href: string; text: string } => c !== null);
  const meta = [invoice.client?.fullName ?? t.invoices.list.noClient, formatDate(`${invoice.issuedOn}T12:00:00Z`, locale, "UTC"), formatMoney(invoice.totalCents, locale)].join(" · ");
  return (
    <DetailLayout
      back={<Link href={routes.invoices}>{t.invoices.title}</Link>}
      eyebrow={invoice.creditOf ? t.invoiceDoc.credit : t.invoiceDoc.title}
      title={<span className="font-mono tabular-nums">{invoice.number}</span>}
      status={
        <Badge tone={STATE_TONE[state]} data-state={state}>
          {t.invoices.state[state]}
        </Badge>
      }
      meta={<span className="tabular-nums">{meta}</span>}
      actions={
        <div className="flex flex-wrap items-start gap-2">
          {invoice.clientId ? <InvoiceSendAction invoiceId={invoice.id} email={invoice.client?.email ?? null} defaultMessage={defaultMessage} primary /> : null}
          {correctable ? (
            <ButtonLink href={routes.invoiceCorrect(invoice.id)} variant="secondary" size="md">
              {t.invoices.actions.correct}
            </ButtonLink>
          ) : null}
          <PrintInvoiceButton label={t.invoices.actions.print} />
        </div>
      }
      aside={
        <div className="flex flex-col gap-6">
          <InvoiceDeliveryHistory deliveries={deliveries} locale={locale} />
          {chain.length ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-base font-semibold text-fg">{t.invoices.chain.title}</h2>
              <ul className="flex flex-col gap-1 text-sm">
                {chain.map((c) => (
                  <li key={c.href}>
                    <Link className="text-fg-accent underline" href={c.href}>
                      {c.text}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      }
    >
      <InvoiceDocument invoice={invoice} locale={locale} heading="h2" />
    </DetailLayout>
  );
}

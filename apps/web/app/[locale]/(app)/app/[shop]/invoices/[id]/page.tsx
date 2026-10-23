// @template: app-detail
import { invoiceDeliveryHistory, invoiceDetail, invoiceMailSettings, shopDay } from "@akinaza/db";
import { Badge } from "@krizaka/ui/badge";
import { DetailLayout } from "@krizaka/ui/detail-layout";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { InvoiceDeliveryHistory } from "@/components/app/InvoiceDeliveryHistory";
import { InvoiceDocument } from "@/components/app/InvoiceDocument";
import { InvoiceSendAction } from "@/components/app/InvoiceSendAction";
import { PrintInvoiceButton } from "@/components/app/PrintInvoiceButton";
import { ButtonLink } from "@/components/ButtonLink";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { asLocale, format, getDictionary } from "@/lib/i18n";
import { invoiceActions, STATE_TONE } from "@/lib/invoice-actions";
import { memberShop } from "@/lib/member-shop";
import { titleOf } from "@/lib/page-title";
import { shopRoutes } from "@/lib/routes";

export const dynamic = "force-dynamic";

export const generateMetadata = titleOf("invoices");

/**
 * One invoice's page (docs/ux/2026-10-full-review.md D3): the way back, the number as the page's h1, its state, when it was
 * issued and to whom, its actions by state (send, correct, print), the document as the client reads it — in the language
 * of the invoice, with the supplier's GST and QST numbers, every line, the taxes to the cent — and, beside it, what it
 * replaces or replaced and the deliveries.
 */
export default async function InvoicePage({ params }: { params: Promise<{ locale: string; shop: string; id: string }> }) {
  const { locale: raw, shop: shopId, id } = await params;
  const locale = asLocale(raw);
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { shop } = await memberShop(shopId, "invoices");
  const invoice = await invoiceDetail(db(), shop.id, id);
  if (!invoice) notFound();
  const [deliveries, mail, today] = await Promise.all([invoiceDeliveryHistory(db(), shop.id, id), invoiceMailSettings(db(), shop.id), shopDay(db(), shop.id, new Date())]);
  const routes = shopRoutes(locale, shop.id);
  const t = getDictionary(locale).console.invoices;
  const actions = invoiceActions(invoice, today);
  const chain = [
    invoice.replaces ? { href: routes.invoice(invoice.replaces.id), text: format(t.chain.replaces, { number: invoice.replaces.number }) } : null,
    invoice.replacedBy ? { href: routes.invoice(invoice.replacedBy.id), text: format(t.chain.replacedBy, { number: invoice.replacedBy.number }) } : null,
    invoice.creditedBy && !invoice.replacedBy ? { href: routes.invoice(invoice.creditedBy.id), text: format(t.chain.creditedBy, { number: invoice.creditedBy.number }) } : null,
  ].filter((c): c is { href: string; text: string } => c !== null);
  return (
    <DetailLayout
      back={<Link href={routes.invoices}>{t.title}</Link>}
      eyebrow={invoice.creditOf ? t.list.credit : undefined}
      title={invoice.number}
      status={<Badge tone={STATE_TONE[actions.state]}>{t.state[actions.state]}</Badge>}
      meta={[format(t.detail.issuedOn, { date: formatDate(`${invoice.issuedOn}T12:00:00Z`, locale, "UTC") }), invoice.client?.fullName ?? t.list.noClient].join(" · ")}
      actions={
        <>
          {actions.send ? <InvoiceSendAction invoiceId={invoice.id} email={invoice.client?.email ?? null} defaultMessage={mail?.shop.message} variant="primary" size="md" /> : null}
          {actions.correct ? (
            <ButtonLink href={routes.invoiceCorrect(invoice.id)} variant="secondary" size="md">
              {t.actions.correct}
            </ButtonLink>
          ) : null}
          <PrintInvoiceButton />
        </>
      }
      aside={
        <div className="flex flex-col gap-4">
          {chain.length ? (
            <ul className="flex flex-col gap-1 text-sm text-fg-secondary">
              {chain.map((c) => (
                <li key={c.href}>
                  <Link className="text-fg-accent underline" href={c.href}>
                    {c.text}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          <InvoiceDeliveryHistory deliveries={deliveries} locale={locale} />
        </div>
      }
    >
      <InvoiceDocument invoice={invoice} locale={locale} heading="h2" />
    </DetailLayout>
  );
}

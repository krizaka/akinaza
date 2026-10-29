import { invoiceDetail, shopDay } from "@akinaza/db";
import { PageHeader } from "@krizaka/ui/page-header";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { InvoiceCorrection } from "@/components/app/InvoiceCorrection";
import { db } from "@/lib/db";
import { asLocale, format, getDictionary } from "@/lib/i18n";
import { memberShop } from "@/lib/member-shop";
import { titleOf } from "@/lib/page-title";
import { shopRoutes } from "@/lib/routes";

export const dynamic = "force-dynamic";

export const generateMetadata = titleOf("invoices");

/** « Modifier » an issued invoice: its lines prefilled; confirming credits the original and issues the replacement (#207). */
export default async function CorrectInvoicePage({ params }: Readonly<{ params: Promise<{ locale: string; shop: string; id: string }> }>) {
  const { locale: raw, shop: shopId, id } = await params;
  const locale = asLocale(raw);
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { shop } = await memberShop(shopId, "invoices");
  const routes = shopRoutes(locale, shop.id);
  const [invoice, today] = await Promise.all([invoiceDetail(db(), shop.id, id), shopDay(db(), shop.id, new Date())]);
  if (!invoice) notFound();
  // Nothing to correct on a credit note, nor on an invoice already credited: back to what it is now.
  if (invoice.creditOf || invoice.creditedBy) redirect(routes.invoice(invoice.replacedBy?.id ?? invoice.id));
  const t = getDictionary(locale).console.invoices.correct;
  return (
    <div className="flex flex-col gap-4">
      <Link className="text-fg-accent underline" href={routes.invoice(invoice.id)}>
        ← {format(t.back, { number: invoice.number })}
      </Link>
      <PageHeader title={format(t.title, { number: invoice.number })} />
      <InvoiceCorrection
        original={{ id: invoice.id, number: invoice.number, clientId: invoice.clientId, language: invoice.language, termsDays: invoice.termsDays }}
        lines={invoice.lines.map((l) => ({ description: l.description, quantity: String(l.quantityHundredths / 100), unitPriceCents: l.unitPriceCents, category: l.taxCategory }))}
        today={today}
      />
    </div>
  );
}

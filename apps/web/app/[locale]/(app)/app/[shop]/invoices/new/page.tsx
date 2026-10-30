import { shopDay } from "@akinaza/db";
import { PageHeader } from "@krizaka/ui/page-header";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { InvoiceForm } from "@/components/app/InvoiceForm";
import { db } from "@/lib/db";
import { asLocale, getDictionary } from "@/lib/i18n";
import { invoiceChoices } from "@/lib/invoice-choices";
import { prefillDraft } from "@/lib/invoice-draft";
import { memberShop } from "@/lib/member-shop";
import { shopRoutes } from "@/lib/routes";
import { requestNow } from "@/app/request-now";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.invoices.new.title };
}

/**
 * A new invoice, on its own address (`/app/<shop>/invoices/new`): the form, nothing else, prefilled from `?client=&service=&quantity=`
 * (« Facturer ce client », a finished appointment). A client or a service of another shop is a 404. It opens the issued invoice when done.
 */
export default async function NewInvoice({ params, searchParams }: Readonly<{ params: Promise<{ locale: string; shop: string }>; searchParams: Promise<{ client?: string; service?: string; quantity?: string; appointment?: string }> }>) {
  const { locale: rawLocale, shop: shopId } = await params;
  const locale = asLocale(rawLocale);
  const { shop } = await memberShop(shopId, "invoices");
  const t = getDictionary(locale).console.invoices;
  const [today, choices] = await Promise.all([shopDay(db(), shop.id, requestNow()), invoiceChoices(shop.id)]);
  const start = prefillDraft(await searchParams, choices);
  if (!start.found) notFound();
  return (
    <div className="flex flex-col gap-4">
      <Link className="text-fg-accent underline" href={shopRoutes(locale, shop.id).invoices}>
        ← {t.back}
      </Link>
      <PageHeader title={t.new.title} />
      <InvoiceForm locale={locale} data={{ today, registrant: shop.registrant, ...choices }} start={{ clientId: start.clientId, lines: start.lines, appointmentId: start.appointmentId }} />
    </div>
  );
}

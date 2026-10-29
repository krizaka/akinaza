import { localDay } from "@akinaza/core";
import { invoiceDetail } from "@akinaza/db";
import { invoiceDeliveryHistory, invoiceMailSettings } from "@akinaza/db";
import { notFound } from "next/navigation";
import { z } from "zod";

import { InvoiceDetailView } from "@/components/app/InvoiceDetailView";
import { db } from "@/lib/db";
import { asLocale } from "@/lib/i18n";
import { memberShop } from "@/lib/member-shop";
import { titleOf } from "@/lib/page-title";
import { shopRoutes } from "@/lib/routes";

export const dynamic = "force-dynamic";

export const generateMetadata = titleOf("invoices");

/** One invoice of the shop (D2): on DetailLayout, its state from the ledger, the document in its own language. */
export default async function InvoicePage({ params, searchParams }: Readonly<{ params: Promise<{ locale: string; shop: string; id: string }>; searchParams: Promise<{ issued?: string }> }>) {
  const { locale: raw, shop: shopId, id } = await params;
  const locale = asLocale(raw);
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { shop } = await memberShop(shopId, "invoices");
  const invoice = await invoiceDetail(db(), shop.id, id);
  if (!invoice) notFound();
  const [deliveries, mail] = await Promise.all([invoiceDeliveryHistory(db(), shop.id, id), invoiceMailSettings(db(), shop.id)]);
  return <InvoiceDetailView invoice={invoice} deliveries={deliveries} locale={locale} routes={shopRoutes(locale, shop.id)} today={localDay(new Date(), shop.timezone)} defaultMessage={mail?.shop.message} issued={(await searchParams).issued === "1"} />;
}

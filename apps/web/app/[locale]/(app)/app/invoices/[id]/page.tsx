import { invoiceDetail } from "@akinaza/db";
import { notFound } from "next/navigation";
import { z } from "zod";

import { InvoiceDocument } from "@/components/app/InvoiceDocument";
import { db } from "@/lib/db";
import { asLocale } from "@/lib/i18n";
import { ownerShop } from "@/lib/owner-shop";
import { titleOf } from "@/lib/page-title";

export const dynamic = "force-dynamic";

export const generateMetadata = titleOf("invoices");

/**
 * One invoice as the client reads it: in the language of the invoice (not of the screen), with the supplier's GST and QST
 * numbers (what a buyer needs to claim the input tax credits), every line, and the taxes to the cent.
 */
export default async function InvoicePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: raw, id } = await params;
  const locale = asLocale(raw);
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { shop } = await ownerShop();
  const invoice = await invoiceDetail(db(), shop.id, id);
  if (!invoice) notFound();
  return <InvoiceDocument invoice={invoice} locale={locale} />;
}

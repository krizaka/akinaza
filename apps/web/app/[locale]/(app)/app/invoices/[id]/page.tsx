import { invoiceDetail, shopOfOwner } from "@akinaza/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { InvoiceDocument } from "@/components/app/InvoiceDocument";
import { pageSession } from "@/lib/access";
import { db } from "@/lib/db";
import { asLocale, getDictionary } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.meta.invoices };
}

/**
 * One invoice as the client reads it: in the language of the invoice (not of the screen), with the supplier's GST and QST
 * numbers (what a buyer needs to claim the input tax credits), every line, and the taxes to the cent.
 */
export default async function InvoicePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: raw, id } = await params;
  const locale = asLocale(raw);
  if (!z.string().uuid().safeParse(id).success) notFound();
  const session = (await pageSession())!;
  const shop = await shopOfOwner(db(), session.account.id);
  if (!shop) notFound();
  const invoice = await invoiceDetail(db(), shop.id, id);
  if (!invoice) notFound();
  return <InvoiceDocument invoice={invoice} locale={locale} />;
}

import { localDay } from "@akinaza/core";
import { invoiceByToken, invoiceReplacementByToken } from "@akinaza/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { InvoicePublicDocument } from "@/components/app/InvoicePublicDocument";
import { PrintInvoiceButton } from "@/components/app/PrintInvoiceButton";
import { db } from "@/lib/db";
import { asLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function PublicInvoicePage({ params, searchParams }: Readonly<{ params: Promise<{ locale: string; token: string }>; searchParams: Promise<{ replacement?: string }> }>) {
  const { locale: raw, token } = await params;
  const locale = asLocale(raw);
  const { replacement } = await searchParams;
  const replacementId = replacement && z.string().uuid().safeParse(replacement).success ? replacement : null;
  const invoice = replacementId
    ? await invoiceReplacementByToken(db(), token, replacementId, new Date())
    : await invoiceByToken(db(), token, new Date());
  // An unknown or expired link is a 404, with the product's calm not-found page (akinaza#381).
  if (!invoice) notFound();
  return (
    <>
      <InvoicePublicDocument invoice={invoice} locale={locale} today={localDay(new Date(), invoice.shop.timezone)} token={token} />
      <div className="mx-auto w-full max-w-3xl px-5 pb-8 sm:px-8"><PrintInvoiceButton /></div>
    </>
  );
}

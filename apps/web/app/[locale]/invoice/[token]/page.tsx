import { localDay } from "@akinaza/core";
import { invoiceByToken, invoiceReplacementByToken } from "@akinaza/db";
import type { Metadata } from "next";
import { z } from "zod";

import { InvoicePublicDocument } from "@/components/app/InvoicePublicDocument";
import { PrintInvoiceButton } from "@/components/app/PrintInvoiceButton";
import { db } from "@/lib/db";
import { asLocale, getDictionary } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function PublicInvoicePage({ params, searchParams }: { params: Promise<{ locale: string; token: string }>; searchParams: Promise<{ replacement?: string }> }) {
  const { locale: raw, token } = await params;
  const locale = asLocale(raw);
  const { replacement } = await searchParams;
  const replacementId = replacement && z.string().uuid().safeParse(replacement).success ? replacement : null;
  const invoice = replacementId
    ? await invoiceReplacementByToken(db(), token, replacementId, new Date())
    : await invoiceByToken(db(), token, new Date());
  const t = getDictionary(locale).console.invoicePublic;
  if (!invoice) {
    return <main className="mx-auto max-w-3xl p-5 sm:p-8"><h1 className="font-display text-2xl font-bold text-fg">{t.expired}</h1><p className="mt-2 text-fg-secondary">{t.expiredHelp}</p></main>;
  }
  return (
    <>
      <InvoicePublicDocument invoice={invoice} locale={locale} today={localDay(new Date(), invoice.shop.timezone)} token={token} />
      <div className="mx-auto w-full max-w-3xl px-5 pb-8 sm:px-8"><PrintInvoiceButton /></div>
    </>
  );
}

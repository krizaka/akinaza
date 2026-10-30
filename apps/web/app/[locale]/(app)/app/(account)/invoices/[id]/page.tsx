import { localDay } from "@akinaza/core";
import { invoiceForClientAccount } from "@akinaza/db";
import { notFound } from "next/navigation";
import { z } from "zod";

import { InvoicePublicDocument } from "@/components/app/InvoicePublicDocument";
import { PrintInvoiceButton } from "@/components/app/PrintInvoiceButton";
import { pageSession } from "@/lib/access";
import { db } from "@/lib/db";
import { asLocale } from "@/lib/i18n";
import { requestNow } from "@/app/request-now";

export const dynamic = "force-dynamic";

export default async function ClientInvoicePage({ params }: Readonly<{ params: Promise<{ locale: string; id: string }> }>) {
  const { locale: raw, id } = await params;
  const locale = asLocale(raw);
  if (!z.string().uuid().safeParse(id).success) notFound();
  const session = await pageSession();
  if (!session) notFound();
  const invoice = await invoiceForClientAccount(db(), session.account.id, id);
  if (!invoice) notFound();
  return (
    <>
      <InvoicePublicDocument invoice={invoice} locale={locale} today={localDay(requestNow(), invoice.shop.timezone)} />
      <div className="mx-auto w-full max-w-3xl px-5 pb-8 sm:px-8"><PrintInvoiceButton /></div>
    </>
  );
}

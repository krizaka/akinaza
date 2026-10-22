// @template: app-list-detail
import { listInvoices, shopOfOwner } from "@akinaza/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InvoicesTable } from "@/components/app/InvoicesTable";
import { ButtonLink } from "@/components/ButtonLink";
import { pageSession } from "@/lib/access";
import { db } from "@/lib/db";
import { asLocale, getDictionary } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.meta.invoices };
}

/** The issued invoices (each opens as a document), and the one primary action: a new invoice, on its own address. */
export default async function Invoices({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const session = (await pageSession())!;
  const shop = await shopOfOwner(db(), session.account.id);
  if (!shop) notFound();
  const t = getDictionary(locale).console.invoices;
  const issued = await listInvoices(db(), shop.id);
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-fg">{t.title}</h1>
        <ButtonLink href={`/${locale}/app/invoices/new`} variant="primary" size="md">
          {t.new.title}
        </ButtonLink>
      </header>
      <section aria-label={t.list.title} className="flex flex-col gap-3">
        {issued.length === 0 ? (
          <p className="text-fg-secondary">{t.list.none}</p>
        ) : (
          <InvoicesTable invoices={issued.map((i) => ({ id: i.id, number: i.number, client: i.client, issuedOn: i.issuedOn, dueOn: i.dueOn, language: i.language, creditOf: i.creditOf, totalCents: i.totalCents }))} />
        )}
      </section>
    </div>
  );
}

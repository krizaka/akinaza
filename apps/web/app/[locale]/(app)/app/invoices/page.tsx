// @template: app-list-detail
import { listInvoices } from "@akinaza/db";

import { InvoicesTable } from "@/components/app/InvoicesTable";
import { ButtonLink } from "@/components/ButtonLink";
import { db } from "@/lib/db";
import { asLocale, getDictionary } from "@/lib/i18n";
import { memberShop } from "@/lib/member-shop";
import { titleOf } from "@/lib/page-title";

export const dynamic = "force-dynamic";

export const generateMetadata = titleOf("invoices");

/** The issued invoices (each opens as a document), and the one primary action: a new invoice, on its own address. */
export default async function Invoices({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const { shop } = await memberShop("invoices");
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

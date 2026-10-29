// @template: app-list-detail
import { localDay } from "@akinaza/core";
import { listInvoices } from "@akinaza/db";
import { invoiceMailSettings } from "@akinaza/db";
import { EmptyState } from "@krizaka/ui/empty-state";
import { Mascot } from "@krizaka/ui/mascots";
import { PageHeader } from "@krizaka/ui/page-header";

import { InvoicesTable } from "@/components/app/InvoicesTable";
import { ButtonLink } from "@/components/ButtonLink";
import { db } from "@/lib/db";
import { asLocale, getDictionary } from "@/lib/i18n";
import { memberShop } from "@/lib/member-shop";
import { organizeData, tagsOfRows } from "@/lib/organize-data";
import { titleOf } from "@/lib/page-title";
import { shopRoutes } from "@/lib/routes";

export const dynamic = "force-dynamic";

export const generateMetadata = titleOf("invoices");

/** The issued invoices (each opens as a document), and the one primary action: a new invoice, on its own address. */
export default async function Invoices({ params, searchParams }: Readonly<{ params: Promise<{ locale: string; shop: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const { locale: rawLocale, shop: shopId } = await params;
  const locale = asLocale(rawLocale);
  const { shop, session, role } = await memberShop(shopId, "invoices");
  const t = getDictionary(locale).console.invoices;
  const [all, organized] = await Promise.all([listInvoices(db(), shop.id), organizeData(shop.id, "invoice", session.account, role, await searchParams)]);
  // The tags, the state (derived from the ledger, `stateSql`), the dates, the number and the saved views narrow the rows in SQL.
  const issued = organized.ids ? all.filter((i) => organized.ids!.has(i.id)) : all;
  const tags = await tagsOfRows(shop.id, "invoice", issued.map((i) => i.id));
  const mail = await invoiceMailSettings(db(), shop.id);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t.title} />
      <section aria-label={t.list.title} className="flex flex-col gap-3">
        {all.length === 0 ? (
          <EmptyState
            icon={<Mascot bird="beaver" mood="empty" size={120} />}
            title={t.list.none}
            description={t.list.noneHint}
            action={
              <ButtonLink href={shopRoutes(locale, shop.id).newInvoice} variant="secondary" size="md">
                {getDictionary(locale).console.shell.newInvoice}
              </ButtonLink>
            }
          />
        ) : (
          <InvoicesTable
            today={localDay(new Date(), shop.timezone)}
            defaultMessage={mail?.shop.message}
            organize={organized.data}
            tagsByInvoice={tags}
            invoices={issued.map((i) => ({ id: i.id, number: i.number, client: i.client, clientId: i.clientId, clientEmail: i.clientEmail, issuedOn: i.issuedOn, dueOn: i.dueOn, language: i.language, creditOf: i.creditOf, subtotalCents: i.subtotalCents, gstCents: i.gstCents, qstCents: i.qstCents, totalCents: i.totalCents, paidCents: i.paidCents, superseded: i.superseded }))}
          />
        )}
      </section>
    </div>
  );
}

// @template: app-list-detail
import { localDay } from "@akinaza/core";
import { invoiceMailSettings, listInvoices } from "@akinaza/db";
import { PageHeader } from "@krizaka/ui/page-header";

import { InvoicesTable } from "@/components/app/InvoicesTable";
import { ButtonLink } from "@/components/ButtonLink";
import { db } from "@/lib/db";
import { asLocale, getDictionary } from "@/lib/i18n";
import { may, memberShop } from "@/lib/member-shop";
import { titleOf } from "@/lib/page-title";
import { shopRoutes } from "@/lib/routes";

export const dynamic = "force-dynamic";

export const generateMetadata = titleOf("invoices");

/** The issued invoices (each opens as a document), and the one primary action: a new invoice, on its own address. */
export default async function Invoices({ params }: { params: Promise<{ locale: string; shop: string }> }) {
  const { locale: rawLocale, shop: shopId } = await params;
  const locale = asLocale(rawLocale);
  const { shop, role } = await memberShop(shopId, "invoices");
  const t = getDictionary(locale).console.invoices;
  const issued = await listInvoices(db(), shop.id);
  const mail = await invoiceMailSettings(db(), shop.id);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t.title}
        actions={
          may(role, "settings") ? (
            <ButtonLink href={shopRoutes(locale, shop.id).invoiceSettings} variant="secondary" size="sm">
              {t.settings.link}
            </ButtonLink>
          ) : null
        }
      />
      <section aria-label={t.list.title} className="flex flex-col gap-3">
        {issued.length === 0 ? (
          <p className="text-fg-secondary">{t.list.none}</p>
        ) : (
          <InvoicesTable
            today={localDay(new Date(), shop.timezone)}
            defaultMessage={mail?.shop.message}
            invoices={issued.map((i) => ({ id: i.id, number: i.number, client: i.client, clientId: i.clientId, clientEmail: i.clientEmail, issuedOn: i.issuedOn, dueOn: i.dueOn, language: i.language, creditOf: i.creditOf, subtotalCents: i.subtotalCents, gstCents: i.gstCents, qstCents: i.qstCents, totalCents: i.totalCents, paidCents: i.paidCents, superseded: i.superseded }))}
          />
        )}
      </section>
    </div>
  );
}

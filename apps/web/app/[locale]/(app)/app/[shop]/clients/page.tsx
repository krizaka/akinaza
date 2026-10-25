// @template: app-list-detail
import { clientOverview } from "@akinaza/db";
import { EmptyState } from "@krizaka/ui/empty-state";
import { Mascot } from "@krizaka/ui/mascots";
import { PageHeader } from "@krizaka/ui/page-header";

import { ClientsCatalogue } from "@/components/app/ClientsCatalogue";
import { readClientsQuery } from "@/lib/clients-view";
import { db } from "@/lib/db";
import { asLocale, getDictionary } from "@/lib/i18n";
import { memberShop } from "@/lib/member-shop";
import { titleOf } from "@/lib/page-title";

export const dynamic = "force-dynamic";

export const generateMetadata = titleOf("clients");

/** The shop's clients on the catalogue template (D5): the plan strip, the search and the filters in the address, the rows with their state and « Facturer ». */
export default async function Clients({ params, searchParams }: { params: Promise<{ locale: string; shop: string }>; searchParams: Promise<{ q?: string; filter?: string }> }) {
  const { locale: rawLocale, shop: shopId } = await params;
  const locale = asLocale(rawLocale);
  const { shop } = await memberShop(shopId, "clients");
  const clients = await clientOverview(db(), shop.id, new Date());
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={getDictionary(locale).console.clients.title} />
      {clients.length === 0 ? (
        <EmptyState icon={<Mascot bird="beaver" mood="empty" size={120} />} title={getDictionary(locale).console.clients.none} />
      ) : (
        <ClientsCatalogue clients={clients} query={readClientsQuery(await searchParams)} timeZone={shop.timezone} />
      )}
    </div>
  );
}

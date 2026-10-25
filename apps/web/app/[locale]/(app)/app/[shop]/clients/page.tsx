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
import { organizeData, tagsOfRows } from "@/lib/organize-data";
import { titleOf } from "@/lib/page-title";

export const dynamic = "force-dynamic";

export const generateMetadata = titleOf("clients");

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** The shop's clients on the catalogue template (D5): the plan strip, the search and the filters in the address, the rows with their state and « Facturer ». */
export default async function Clients({ params: routeParams, searchParams }: { params: Promise<{ locale: string; shop: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale: rawLocale, shop: shopId } = await routeParams;
  const locale = asLocale(rawLocale);
  const { shop, session, role } = await memberShop(shopId, "clients");
  const params = await searchParams;
  // The tags, the dates and the saved views narrow the rows in SQL (`filterSql`); the search stays the list's own, without accents.
  const [all, organized] = await Promise.all([clientOverview(db(), shop.id, new Date()), organizeData(shop.id, "client", session.account, role, params, ["q"])]);
  const clients = organized.ids ? all.filter((c) => organized.ids!.has(c.id)) : all;
  const tags = await tagsOfRows(shop.id, "client", clients.map((c) => c.id));
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={getDictionary(locale).console.clients.title} />
      {all.length === 0 ? (
        <EmptyState icon={<Mascot bird="beaver" mood="empty" size={120} />} title={getDictionary(locale).console.clients.none} />
      ) : (
        <ClientsCatalogue clients={clients} query={readClientsQuery({ q: first(params.q), filter: first(params.filter) })} timeZone={shop.timezone} organize={organized.data} tagsByClient={tags} />
      )}
    </div>
  );
}

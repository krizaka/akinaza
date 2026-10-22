// @template: app-list-detail
import { clientOverview } from "@akinaza/db";

import { ClientsTable } from "@/components/app/ClientsTable";
import { db } from "@/lib/db";
import { asLocale, getDictionary } from "@/lib/i18n";
import { memberShop } from "@/lib/member-shop";
import { titleOf } from "@/lib/page-title";

export const dynamic = "force-dynamic";

export const generateMetadata = titleOf("clients");

/** The shop's clients: how often they came, when last and next, what they spent. Each name opens the client's file. */
export default async function Clients({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const { shop } = await memberShop("clients");
  const clients = await clientOverview(db(), shop.id, new Date());
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold text-fg">{getDictionary(locale).console.clients.title}</h1>
      {clients.length === 0 ? <p className="text-fg-secondary">{getDictionary(locale).console.clients.none}</p> : <ClientsTable clients={clients} timeZone={shop.timezone} />}
    </div>
  );
}

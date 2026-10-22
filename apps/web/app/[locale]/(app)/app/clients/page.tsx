// @template: app-list-detail
import { clientOverview, shopOfOwner } from "@akinaza/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClientsTable } from "@/components/app/ClientsTable";
import { pageSession } from "@/lib/access";
import { db } from "@/lib/db";
import { asLocale, getDictionary } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.meta.clients };
}

/** The shop's clients: how often they came, when last and next, what they spent. Each name opens the client's file. */
export default async function Clients({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const session = (await pageSession())!;
  const shop = await shopOfOwner(db(), session.account.id);
  if (!shop) notFound();
  const clients = await clientOverview(db(), shop.id, new Date());
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold text-fg">{getDictionary(locale).console.clients.title}</h1>
      {clients.length === 0 ? <p className="text-fg-secondary">{getDictionary(locale).console.clients.none}</p> : <ClientsTable clients={clients} timeZone={shop.timezone} />}
    </div>
  );
}

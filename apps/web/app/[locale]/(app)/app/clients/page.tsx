import { shopClients, shopOfOwner } from "@akinaza/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClientsList } from "@/components/app/ClientsList";
import { pageSession } from "@/lib/access";
import { db } from "@/lib/db";
import { asLocale, getDictionary } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.meta.clients };
}

/** The walker's clients and their dogs. Access notes are never in this list: each is opened on demand and audited. */
export default async function Clients({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const session = (await pageSession())!;
  const shop = await shopOfOwner(db(), session.account.id);
  if (!shop) notFound();
  const clients = await shopClients(db(), shop.id);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold text-fg">{getDictionary(locale).console.clients.title}</h1>
      <ClientsList clients={clients} />
    </div>
  );
}

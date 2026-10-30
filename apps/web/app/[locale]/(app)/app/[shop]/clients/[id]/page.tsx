// @template: app-list-detail
import { localDay } from "@akinaza/core";
import { clientFile, clientNotes, clientOverview, clientRequestsOf } from "@akinaza/db";
import { SplitView } from "@krizaka/ui/split-view";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ClientFilePanel } from "@/components/app/ClientFilePanel";
import { ClientNav } from "@/components/app/ClientNav";
import { ClientPrivacyPanel } from "@/components/app/ClientPrivacyPanel";
import { ClientRequestsPanel } from "@/components/app/ClientRequestsPanel";
import { readClientFileTab } from "@/lib/clients-view";
import { db } from "@/lib/db";
import { asLocale, getDictionary } from "@/lib/i18n";
import { may, memberShop } from "@/lib/member-shop";
import { organizeData, tagsOfRows } from "@/lib/organize-data";
import { titleOf } from "@/lib/page-title";
import { shopRoutes } from "@/lib/routes";
import { isUuid } from "@/lib/shop-id";
import { requestNow } from "@/app/request-now";

export const dynamic = "force-dynamic";

export const generateMetadata = titleOf("clients");

/** One client's file, with the clients beside it on a computer (one at a time on a phone, the way back above). The address names the client. */
export default async function ClientPage({ params, searchParams }: Readonly<{ params: Promise<{ locale: string; shop: string; id: string }>; searchParams: Promise<{ tab?: string }> }>) {
  const { locale: rawLocale, shop: shopId, id } = await params;
  const locale = asLocale(rawLocale);
  const t = getDictionary(locale).console.clients;
  const { shop, role, session } = await memberShop(shopId, "clients");
  if (!isUuid(id)) notFound();
  const now = requestNow();
  const [file, overview] = await Promise.all([clientFile(db(), shop.id, id), clientOverview(db(), shop.id, now)]);
  if (!file) notFound();
  // The client is this shop's (clientFile above): what they keep here, for the visit (akinaza#210).
  const [requests, notes, organized] = await Promise.all([clientRequestsOf(db(), id), clientNotes(db(), shop.id, id), organizeData(shop.id, "client", session.account, role, {})]);
  const worn = (await tagsOfRows(shop.id, "client", [id]))[id] ?? [];
  return (
    <SplitView
      listTitle={t.title}
      list={<ClientNav clients={overview} currentId={id} routes={shopRoutes(locale, shop.id)} />}
      showDetail
      back={
        <Link href={shopRoutes(locale, shop.id).clients} className="text-sm font-semibold text-fg-accent">
          ← {t.back}
        </Link>
      }
      detail={
        <div className="flex flex-col gap-5">
          <ClientFilePanel file={file} notes={notes} tab={readClientFileTab((await searchParams).tab)} today={localDay(now, shop.timezone)} timeZone={shop.timezone} nowIso={now.toISOString()} mayInvoice={may(role, "invoices")} organize={organized.data} tags={worn} />
          {may(role, "privacy") ? <ClientPrivacyPanel clientId={id} /> : null}
          <ClientRequestsPanel requests={requests.map((r) => ({ id: r.id, title: r.title, note: r.note, service: { fr: r.serviceNameFr, en: r.serviceNameEn }, staffName: r.staffName, files: r.files }))} />
        </div>
      }
    />
  );
}

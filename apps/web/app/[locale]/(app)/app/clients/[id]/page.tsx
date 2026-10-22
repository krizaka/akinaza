// @template: app-list-detail
import { clientFile, clientOverview } from "@akinaza/db";
import { SplitView } from "@krizaka/ui/split-view";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ClientFilePanel } from "@/components/app/ClientFilePanel";
import { ClientNav } from "@/components/app/ClientNav";
import { db } from "@/lib/db";
import { asLocale, getDictionary } from "@/lib/i18n";
import { memberShop } from "@/lib/member-shop";
import { titleOf } from "@/lib/page-title";

export const dynamic = "force-dynamic";

export const generateMetadata = titleOf("clients");

/** One client's file, with the clients beside it on a computer (one at a time on a phone, the way back above). The address names the client. */
export default async function ClientPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: rawLocale, id } = await params;
  const locale = asLocale(rawLocale);
  const t = getDictionary(locale).console.clients;
  const { shop } = await memberShop("clients");
  const now = new Date();
  const [file, overview] = await Promise.all([clientFile(db(), shop.id, id), clientOverview(db(), shop.id, now)]);
  if (!file) notFound();
  return (
    <SplitView
      listTitle={t.title}
      list={<ClientNav clients={overview} currentId={id} locale={locale} />}
      showDetail
      back={
        <Link href={`/${locale}/app/clients`} className="text-sm font-semibold text-fg-accent">
          ← {t.back}
        </Link>
      }
      detail={<ClientFilePanel file={file} timeZone={shop.timezone} nowIso={now.toISOString()} />}
    />
  );
}

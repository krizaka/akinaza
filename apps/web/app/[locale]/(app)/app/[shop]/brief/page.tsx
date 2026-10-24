// @template: app-dashboard
import { PageHeader } from "@krizaka/ui/page-header";
import type { Metadata } from "next";

import { MondayBrief } from "@/components/app/MondayBrief";
import { loadShopBrief } from "@/lib/brief";
import { asLocale, getDictionary } from "@/lib/i18n";
import { memberShop } from "@/lib/member-shop";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.brief.title };
}

/** « Le point du lundi » in full, on its own address: Today only announces it (docs/ux/2026-10-full-review.md B2). */
export default async function BriefPage({ params }: { params: Promise<{ locale: string; shop: string }> }) {
  const { locale: raw, shop: shopId } = await params;
  const locale = asLocale(raw);
  const { shop } = await memberShop(shopId, "reports");
  const brief = await loadShopBrief(shop, new Date());
  const t = getDictionary(locale).console.brief;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t.title} description={brief.items.length ? t.lead : t.empty} />
      <MondayBrief items={brief.items.map((i) => ({ id: i.id, kind: i.kind, subject: i.subject, figures: { ...i.figures }, assumptions: [...i.assumptions] }))} done={brief.done} services={brief.services} publicPage={brief.publicPage} />
    </div>
  );
}

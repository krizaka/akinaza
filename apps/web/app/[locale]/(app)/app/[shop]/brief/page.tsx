// @template: app-dashboard
import { shopDay } from "@akinaza/db";
import { PageHeader } from "@krizaka/ui/page-header";
import type { Metadata } from "next";

import { FiguresPanel } from "@/components/app/FiguresPanel";
import { LexiconSection } from "@/components/app/LexiconSection";
import { MondayBrief } from "@/components/app/MondayBrief";
import { WhatToDoNow } from "@/components/app/WhatToDoNow";
import { loadShopBrief } from "@/lib/brief";
import { db } from "@/lib/db";
import { loadFigures } from "@/lib/figures";
import { asLocale, getDictionary } from "@/lib/i18n";
import { memberShop } from "@/lib/member-shop";
import { shopRoutes } from "@/lib/routes";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.brief.title };
}

/** « Le point du lundi » in full, on its own address: Today only announces it (docs/ux/2026-10-full-review.md B2). */
export default async function BriefPage({ params }: Readonly<{ params: Promise<{ locale: string; shop: string }> }>) {
  const { locale: raw, shop: shopId } = await params;
  const locale = asLocale(raw);
  const { shop } = await memberShop(shopId, "reports");
  const brief = await loadShopBrief(shop, new Date());
  const t = getDictionary(locale).console.brief;
  const now = new Date();
  const { figures, actions } = await loadFigures(shop, await shopDay(db(), shop.id, now), now);
  const routes = shopRoutes(locale, shop.id);
  const f = getDictionary(locale).console.figures;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t.title} description={brief.items.length ? t.lead : t.empty} />
      <MondayBrief items={brief.items.map((i) => ({ id: i.id, kind: i.kind, subject: i.subject, figures: { ...i.figures }, assumptions: [...i.assumptions] }))} done={brief.done} services={brief.services} publicPage={brief.publicPage} />
      <WhatToDoNow actions={actions} locale={locale} routes={routes} />
      <section aria-labelledby="brief-figures" className="flex flex-col gap-3">
        <h2 id="brief-figures" className="text-lg font-semibold">{f.title}</h2>
        <p className="text-sm text-fg-muted">{f.lead}</p>
        <FiguresPanel ids={["invoiced", "collected", "toCollect", "margin", "appointments", "noShows"]} figures={figures} locale={locale} routes={routes} timeZone={shop.timezone} now={now.toISOString()} />
      </section>
      <LexiconSection locale={locale} />
    </div>
  );
}

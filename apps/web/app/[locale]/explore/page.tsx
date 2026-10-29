import type { Metadata } from "next";

import { ExploreView, type ExploreWords } from "@/components/explore/ExploreView";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { jsonLdHtml } from "@/lib/csp";
import { asLocale, getDictionary } from "@/lib/i18n";
import { pageMetadata, siteJsonLd } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return pageMetadata(asLocale((await params).locale), "explore");
}

/**
 * Explorer (krizaka/akinaza#235): the published shops on a map and in a list, by address or postal code, « near me », filtered by
 * kind of service, open now and a free time today. The page is static (its words); the shops are asked from `/api/explore/shops`
 * by the browser (`@krizaka/query`), so a shop's change shows without a rebuild, and only public facts travel.
 */
export default async function Explore({ params }: Readonly<{ params: Promise<{ locale: string }> }>) {
  const locale = asLocale((await params).locale);
  const d = getDictionary(locale).explore;
  const words: ExploreWords = {
    search: { label: d.search.label, placeholder: d.search.placeholder, submit: d.search.submit, nearMe: d.search.nearMe, nearMeBusy: d.search.nearMeBusy, clear: d.search.clear, centredOn: d.search.centredOn, centredOnYou: d.search.centredOnYou, nearMeNote: d.search.nearMeNote, denied: d.search.denied, unavailable: d.search.unavailable, off: d.search.off, none: d.search.none, pick: d.search.pick, attribution: d.search.attribution },
    filters: d.filters,
    list: { label: d.list.label, count: d.list.count, countOne: d.list.count_one, visit: d.list.visit, open: d.list.open, free: d.list.free, away: d.list.away, notOnMap: d.list.notOnMap, quartiers: d.list.quartiers },
    view: { list: d.view.list, map: d.view.map },
    map: { label: d.map.label, you: d.map.you },
    empty: d.empty,
    error: d.error,
    loading: d.loading,
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(siteJsonLd(locale)) }} />
      <SiteHeader locale={locale} current="explore" />
      <main id="content" className="mx-auto flex w-full max-w-(--kz-page-max,72rem) flex-col gap-6 px-4 pb-16 pt-24 sm:px-8">
        <header className="flex flex-col gap-2">
          <h1 className="m-0 font-display text-3xl font-bold text-fg">{d.title}</h1>
          <p className="m-0 max-w-prose text-fg-secondary">{d.lead}</p>
        </header>
        <ExploreView locale={locale} words={words} />
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}

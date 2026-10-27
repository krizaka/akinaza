import { DocsHubPage } from "@krizaka/ui/docs-hub-page";
import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/SiteChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { docHref } from "@/lib/docs";
import { asLocale, getDictionary } from "@/lib/i18n";
import { pageMetadata, siteJsonLd } from "@/lib/seo";
import { DOC_IDS, pagePath } from "@/lib/site";

export async function generateMetadata({ params }: Readonly<{ params: Promise<{ locale: string }> }>): Promise<Metadata> {
  return pageMetadata(asLocale((await params).locale), "docs");
}

/** The owner's guide: five pages, one job each, in the product's own words (akinaza#382). The five appear once, as the list; the card above it is the entry (akinaza#440). */
export default async function Docs({ params }: Readonly<{ params: Promise<{ locale: string }> }>) {
  const locale = asLocale((await params).locale);
  const d = getDictionary(locale).docs;
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd(locale)) }} />
      <SiteHeader locale={locale} current="docs" />
      <main id="content" className="pt-20">
        <DocsHubPage
          title={d.title}
          lead={d.lead}
          linkAs={Link}
          collectionsTitle={d.collectionsTitle}
          collections={[{ id: "akinaza", brand: "akinaza", title: d.collection.title, href: pagePath(locale, "docs/shop"), description: d.collection.description, links: [] }]}
          popular={{ title: d.popularTitle, items: DOC_IDS.map((id) => ({ href: docHref(locale, id), title: d.pages[id].title })) }}
        />
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}

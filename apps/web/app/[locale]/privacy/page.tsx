import { Page } from "@krizaka/ui/page";
import { PageHero } from "@krizaka/ui/page-hero";
import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/SiteChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { asLocale, format, getDictionary } from "@/lib/i18n";
import { pageMetadata, siteJsonLd } from "@/lib/seo";
import { pagePath, PRIVACY_UPDATED } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return pageMetadata(asLocale((await params).locale), "privacy");
}

/** What happens to a document, in plain words. */
export default async function Privacy({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const t = getDictionary(locale);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd(locale)) }} />
      <SiteHeader locale={locale} current="privacy" />
      <main id="content" className="pt-20">
        <PageHero back={{ href: pagePath(locale, "home"), label: t.meta.siteName }} linkAs={Link} title={t.privacy.title} lead={format(t.privacy.updated, { date: PRIVACY_UPDATED })} />
        <Page>
          <p className="max-w-3xl text-base leading-relaxed text-fg-secondary">{t.privacy.body}</p>
          <section id="officer" className="mt-8 max-w-3xl">
            <h2 className="m-0 text-xl font-semibold text-fg">{t.privacy.officer.title}</h2>
            <p className="mt-2 text-base leading-relaxed text-fg-secondary">{format(t.privacy.officer.text, { role: t.privacy.officer.role })}</p>
          </section>
        </Page>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}

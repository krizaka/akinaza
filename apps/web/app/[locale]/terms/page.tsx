import { Alert } from "@krizaka/ui/alert";
import { Page } from "@krizaka/ui/page";
import { PageHero } from "@krizaka/ui/page-hero";
import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { asLocale, format, getDictionary } from "@/lib/i18n";
import { publisherVars } from "@/lib/publisher";
import { pageMetadata, siteJsonLd } from "@/lib/seo";
import { pagePath, TERMS_VERSION } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return pageMetadata(asLocale((await params).locale), "terms");
}

/**
 * The terms of use, written in good faith from the law (Loi sur la protection du consommateur, Code civil du Québec, Loi 25).
 * Under the Charter of the French Language the French text is the reference. A draft until the single lawyer review
 * (krizaka/.github#250): `data-lawyer-review` marks it, and the status line says so.
 */
export default async function Terms({ params }: Readonly<{ params: Promise<{ locale: string }> }>) {
  const locale = asLocale((await params).locale);
  const t = getDictionary(locale);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd(locale)) }} />
      <SiteHeader locale={locale} current="terms" />
      <main id="content" className="pt-20" data-lawyer-review="pending" data-terms-version={TERMS_VERSION}>
        <PageHero back={{ href: pagePath(locale, "home"), label: t.meta.siteName }} linkAs={Link} title={t.terms.title} lead={format(t.terms.version, { version: TERMS_VERSION })} />
        <Page>
          <Alert tone="warning">{t.terms.status}</Alert>
          {t.terms.sections.map((s) => (
            <section key={s.h} className="mt-8 max-w-3xl">
              <h2 className="m-0 text-xl font-semibold text-fg">{s.h}</h2>
              <p className="mt-2 text-base leading-relaxed text-fg-secondary">{format(s.p, publisherVars())}</p>
            </section>
          ))}
          <p className="mt-8 max-w-3xl">
            <Link className="font-semibold text-fg-accent" href={pagePath(locale, "privacy")}>
              {t.terms.privacyLink}
            </Link>
          </p>
        </Page>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}

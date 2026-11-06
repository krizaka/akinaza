import { PageHero } from "@krizaka/ui/page-hero";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ButtonLink } from "@/components/ButtonLink";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { pageSession } from "@/lib/access";
import { jsonLdHtml } from "@/lib/csp";
import { asLocale, getDictionary } from "@/lib/i18n";
import { accountRoutes } from "@/lib/routes";
import { pageMetadata, siteJsonLd } from "@/lib/seo";
import { contactHref, pagePath } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return pageMetadata(asLocale((await params).locale), "pricing");
}

/**
 * The public pricing says no price (founder, 2026-11-05, krizaka-internal#2630): the product is paused, access is by invitation, and the
 * one way in is Krizaka's contact form. The catalogue and the founder offer are not read here; a signed-in owner reads her plan inside
 * the app (Subscription), as before.
 */
export default async function Pricing({ params }: Readonly<{ params: Promise<{ locale: string }> }>) {
  const locale = asLocale((await params).locale);
  const t = getDictionary(locale);
  if (await pageSession().catch(() => null)) {redirect(accountRoutes(locale).section("subscription"));}
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(siteJsonLd(locale)) }} />
      <SiteHeader locale={locale} current="pricing" />
      <main id="content" className="pt-20">
        <PageHero back={{ href: pagePath(locale, "home"), label: t.meta.siteName }} linkAs={Link} title={t.pricing.access.title} lead={t.pricing.access.lead}>
          <ButtonLink href={contactHref(locale)} variant="primary" size="lg">
            {t.pricing.access.cta}
          </ButtonLink>
        </PageHero>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}

import { ForwardIcon } from "@krizaka/icons";
import { Button } from "@krizaka/ui/button";
import { LandingPage } from "@krizaka/ui/landing-page";
import { Section } from "@krizaka/ui/page";
import type { Metadata } from "next";
import Link from "next/link";
import { preconnect } from "react-dom";

import { FounderOffer } from "@/components/home/FounderOffer";
import { HeroPhone } from "@/components/home/HeroPhone";
import { NeighbourhoodFeed } from "@/components/home/NeighbourhoodFeed";
import { BookPreview } from "@/components/home/previews/BookPreview";
import { BooksPreview } from "@/components/home/previews/BooksPreview";
import { InvoicePreview } from "@/components/home/previews/InvoicePreview";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { pageSession } from "@/lib/access";
import { jsonLdHtml } from "@/lib/csp";
import { env } from "@/lib/env";
import { homeFeed } from "@/lib/home-feed";
import { asLocale, getDictionary } from "@/lib/i18n";
import { DEMO_SHOP, heroActions, productStatus, SCREENS } from "@/lib/landing";
import { pageMetadata, siteJsonLd } from "@/lib/seo";
import { heroTake, MEDIA_CDN } from "@/lib/tour";

import preview from "../../../../dev-preview.json";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return pageMetadata(asLocale((await params).locale), "home");
}

/**
 * The home, short: the promise beside the real app on a phone, the three jobs on real screens (a booking, an invoice, the
 * quarter's books), the founder offer once it is live, one way in, a quiet line of trust. The tax return is prepared, never filed.
 */
export default async function Home({ params }: Readonly<{ params: Promise<{ locale: string }> }>) {
  const locale = asLocale((await params).locale);
  const d = getDictionary(locale).landing;
  const status = productStatus(preview);
  // The storefront still is the page's LCP: open the CDN's connection now and fetch it at once (React hoists the link into <head>).
  preconnect(MEDIA_CDN);
  // The hero's action follows the session, rendered on the server: no flash of the signed-out action.
  const feed = await homeFeed(locale);
  const hero = heroActions(locale, Boolean(await pageSession().catch(() => null)));
  // The three jobs are the real components of the app, drawn with demo data (akinaza#470): below the fold, never the LCP.
  const previews = { book: <BookPreview locale={locale} />, invoice: <InvoicePreview locale={locale} />, books: <BooksPreview locale={locale} /> };
  return (
    <>
      <link rel="preload" as="image" href={heroTake(locale).poster} fetchPriority="high" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(siteJsonLd(locale)) }} />
      <SiteHeader locale={locale} current="home" />
      <main id="content">
        <LandingPage
          id="hero"
          title={d.title}
          lead={d.lead}
          visualLabel={d.visualLabel}
          visual={<HeroPhone locale={locale} />}
          actions={
            <>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <Button asChild variant="primary" size="lg" className="w-full sm:w-auto">
                  <Link href={hero.primary.href}>
                    {d.actions[hero.primary.message]} <ForwardIcon size={16} strokeWidth={2.25} />
                  </Link>
                </Button>
                {hero.secondary ? (
                  <Button asChild variant="secondary" size="lg" className="w-full sm:w-auto">
                    <Link href={hero.secondary.href}>{d.actions[hero.secondary.message]}</Link>
                  </Button>
                ) : null}
              </div>
              {/* What Akinaza is not for protects the product's claims: under the hero's actions, at a readable size (akinaza#440). */}
              <p className="m-0 mt-4 max-w-prose text-base text-fg-secondary" data-testid="scope-line">
                {d.trust.scope}
              </p>
            </>
          }
          features={SCREENS.map(({ id }) => ({
            id,
            icon: null,
            title: d.screens[id].title,
            text: d.screens[id].text,
            visual: previews[id],
          }))}
        >
          {env().APP_FOUNDER_OFFER_ENABLED && <FounderOffer locale={locale} />}
          {feed.flyers.length > 0 && (
            <Section
              id="neighbourhood"
              spacing="sm"
              title={d.feed.title}
              lead={d.feed.lead}
              actions={
                <Button asChild variant="secondary" size="md">
                  <Link href={`/${locale}/s/${DEMO_SHOP}`}>{d.feed.demo}</Link>
                </Button>
              }
            >
              <NeighbourhoodFeed initial={feed} locale={locale} words={{ filterLabel: d.feed.filterLabel, all: d.feed.all, boardLabel: d.feed.boardLabel, visit: d.feed.visit, empty: d.feed.empty, error: d.feed.error }} />
            </Section>
          )}
          <Section id="trust" spacing="sm">
            <p className="m-0 text-sm text-fg-muted" data-testid="trust-line">
              {d.trust.line}
            </p>
            <p className="m-0 mt-1 text-sm text-fg-muted">{d.status[status]}</p>
          </Section>
        </LandingPage>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}

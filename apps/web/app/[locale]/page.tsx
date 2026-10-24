import { ForwardIcon } from "@krizaka/icons";
import { Button } from "@krizaka/ui/button";
import { LandingPage } from "@krizaka/ui/landing-page";
import { Section } from "@krizaka/ui/page";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { preconnect } from "react-dom";

import { FounderOffer } from "@/components/home/FounderOffer";
import { HeroPhone } from "@/components/home/HeroPhone";
import { SiteHeader } from "@/components/SiteChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { pageSession } from "@/lib/access";
import { env } from "@/lib/env";
import { asLocale, getDictionary } from "@/lib/i18n";
import { heroActions, productStatus, SCREENS } from "@/lib/landing";
import { pageMetadata, siteJsonLd } from "@/lib/seo";
import { heroTake, MEDIA_CDN, screenStill } from "@/lib/tour";

import preview from "../../../../dev-preview.json";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return pageMetadata(asLocale((await params).locale), "home");
}

/**
 * The home, short: the promise beside the real app on a phone, the three jobs on real screens (a booking, an invoice, the
 * quarter's books), the founder offer once it is live, one way in, a quiet line of trust. The tax return is prepared, never filed.
 */
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const d = getDictionary(locale).landing;
  const status = productStatus(preview);
  // The storefront still is the page's LCP: open the CDN's connection now and fetch it at once (React hoists the link into <head>).
  preconnect(MEDIA_CDN);
  // The hero's action follows the session, rendered on the server: no flash of the signed-out action.
  const hero = heroActions(locale, Boolean(await pageSession().catch(() => null)));
  return (
    <>
      <link rel="preload" as="image" href={heroTake(locale).poster} fetchPriority="high" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd(locale)) }} />
      <SiteHeader locale={locale} current="home" />
      <main id="content">
        <LandingPage
          id="hero"
          title={d.title}
          lead={d.lead}
          visualLabel={d.visualLabel}
          visual={<HeroPhone locale={locale} />}
          actions={
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
          }
          features={SCREENS.map(({ id }) => ({
            id,
            icon: null,
            title: d.screens[id].title,
            text: d.screens[id].text,
            visual: <Image src={screenStill(id, locale)} alt={d.screens[id].alt} width={780} height={1688} unoptimized loading="lazy" className="h-72 w-full rounded-lg border border-border-default object-cover object-top" />,
          }))}
        >
          {env().APP_FOUNDER_OFFER_ENABLED && <FounderOffer locale={locale} />}
          <Section id="trust" spacing="sm">
            <p className="m-0 text-sm text-fg-muted" data-testid="trust-line">
              {d.trust.line}
            </p>
            <p className="m-0 mt-1 text-sm text-fg-muted">{d.trust.scope}</p>
            <p className="m-0 mt-1 text-sm text-fg-muted">{d.status[status]}</p>
          </Section>
        </LandingPage>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}

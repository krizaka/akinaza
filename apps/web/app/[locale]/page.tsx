import { CalendarIcon, CheckIcon, ForwardIcon, GlobeIcon, KeepIcon, LockIcon, PaidIcon } from "@krizaka/icons";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { CardGrid } from "@krizaka/ui/card-grid";
import { LandingPage } from "@krizaka/ui/landing-page";
import { LinkCard } from "@krizaka/ui/link-card";
import { MascotQuote } from "@krizaka/ui/mascot-quote";
import { MetaRow } from "@krizaka/ui/meta-row";
import { NumberTicker } from "@krizaka/ui/number-ticker";
import { Section } from "@krizaka/ui/page";
import type { Metadata } from "next";
import Link from "next/link";
import { preconnect } from "react-dom";

import { ComparisonSection } from "@/components/home/ComparisonSection";
import { FaqSection } from "@/components/home/FaqSection";
import { HeroPhone } from "@/components/home/HeroPhone";
import { JourneyTour } from "@/components/JourneyTour";
import { SiteHeader } from "@/components/SiteChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { asLocale, getDictionary } from "@/lib/i18n";
import { DEMO_SHOP, FIGURES, OUTCOMES, productStatus, TRUST } from "@/lib/landing";
import { pageMetadata, siteJsonLd } from "@/lib/seo";
import { contactHref, pagePath, REPO_URL } from "@/lib/site";
import { heroTake, MEDIA_CDN, TOUR, tourClip, tourStill } from "@/lib/tour";

import preview from "../../../../dev-preview.json";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return pageMetadata(asLocale((await params).locale), "home");
}

const OUTCOME_ICONS = { bookings: <CalendarIcon />, reports: <CheckIcon />, taxes: <PaidIcon /> } as const;
const TRUST_ICONS = { canada: <GlobeIcon />, prepare: <LockIcon />, open: <KeepIcon /> } as const;

/**
 * dev.akinaza.com — the product landing template of @krizaka/ui (`LandingPage`): the promise beside the real storefront on a
 * phone, a band of figures read from the tax code, a bento of what a shop can do, then our sections — the recorded journey
 * (StepShowcase), the comparison with the usual stack, trust, the FAQ — and the closing call. Akinaza prepares the tax return
 * and never files it; it is not for restaurants and bars.
 */
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const d = getDictionary(locale).landing;
  const status = productStatus(preview);
  const signIn = `/${locale}/sign-in`;
  const shop = `/${locale}/s/${DEMO_SHOP}`;
  const trustHref = { canada: pagePath(locale, "privacy"), prepare: signIn, open: REPO_URL } as const;
  const steps = TOUR.steps.map((id) => ({ id, title: d.tour.steps[id].title, description: d.tour.steps[id].text, alt: d.tour.steps[id].alt, poster: tourStill(id, locale), video: tourClip(id, locale) }));
  // The storefront still is the page's LCP: open the CDN's connection now and fetch it at once (React hoists the link into <head>).
  preconnect(MEDIA_CDN);
  return (
    <>
      <link rel="preload" as="image" href={heroTake(locale).poster} fetchPriority="high" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd(locale)) }} />
      <SiteHeader locale={locale} current="home" />
      <main id="content">
        <LandingPage
          id="hero"
          eyebrow={d.eyebrow}
          title={d.title}
          lead={d.lead}
          visualLabel={d.visualLabel}
          visual={<HeroPhone locale={locale} />}
          actions={
            <>
              <Button asChild variant="primary" size="lg" className="w-full sm:w-auto">
                <a href={contactHref("dev-akinaza-hero")}>
                  {d.talk} <ForwardIcon size={16} strokeWidth={2.25} />
                </a>
              </Button>
            </>
          }
          proofs={[
            { value: <NumberTicker value={FIGURES.gst} locale={locale} format={{ maximumFractionDigits: 3 }} />, label: d.figures.gst },
            { value: <NumberTicker value={FIGURES.qst} locale={locale} format={{ maximumFractionDigits: 3 }} />, label: d.figures.qst },
            { value: <NumberTicker value={FIGURES.languages} locale={locale} />, label: d.figures.languages },
          ]}
          featuresHeading={{ eyebrow: d.features.eyebrow, title: d.features.title, lead: d.features.lead }}
          features={OUTCOMES.map((o, i) => ({ id: o.id, size: (["lg", "md", "sm"] as const)[i], icon: OUTCOME_ICONS[o.id], title: d.outcomes[o.id].title, text: d.outcomes[o.id].text }))}
          closing={{
            title: d.closing.title,
            body: d.closing.body,
            actions: (
              <Button asChild variant="primary" size="lg">
                <a href={contactHref("dev-akinaza-closing")}>{d.talk}</a>
              </Button>
            ),
          }}
        >
          {/* How it works — the real recorded journey, then the books; the beaver keeps its promise. */}
          <Section id="how" eyebrow={d.how.eyebrow} title={d.how.title} lead={d.how.lead} reveal divider>
            <figure className="m-0 flex flex-col gap-3">
              <JourneyTour label={d.tour.label} steps={steps} words={{ play: d.tour.play, pause: d.tour.pause, step: d.tour.step }} />
              <figcaption className="text-center font-mono text-xs text-fg-muted md:text-start">{d.tour.captured}</figcaption>
            </figure>
            <div className="mt-8 flex flex-col gap-2 rounded-2xl border border-border-default bg-surface-1 p-5 md:flex-row md:items-start md:gap-6" data-reveal="">
              <Badge tone="accent" className="self-start">
                {d.books.badge}
              </Badge>
              <div className="flex flex-col gap-1">
                <h3 className="m-0 text-base font-semibold text-fg">{d.how.steps.books.title}</h3>
                <p className="m-0 max-w-[70ch] text-sm leading-relaxed text-fg-secondary">{d.how.steps.books.text}</p>
                <p className="m-0 mt-1 text-sm font-semibold text-fg-accent">{d.trust.prepare.title}</p>
              </div>
            </div>
            <div className="mt-10">
              <MascotQuote bird="beaver" label={d.how.beaverLabel} variant="callout">
                {d.how.beaver}
              </MascotQuote>
            </div>
          </Section>

          <ComparisonSection locale={locale} />

          {/* Trust — Loi 25 and Canada, prepared never filed, the code; Orazaka named once, honestly; the status. */}
          <Section id="trust" eyebrow={d.trust.eyebrow} title={d.trust.title} lead={d.trust.lead} reveal divider>
            <CardGrid min={300}>
              {TRUST.map((id) => (
                <LinkCard key={id} layout="stack" href={trustHref[id]} icon={TRUST_ICONS[id]} title={d.trust[id].title} description={d.trust[id].text} cta={d.trust[id].cta} linkAs={Link} />
              ))}
            </CardGrid>
            <MetaRow
              className="mt-6"
              size="md"
              items={[d.trust.powered, "Apache-2.0"]}
              chips={[
                <Badge key="status" tone={status === "preview" ? "accent" : "warning"} title={d.status[status]}>
                  {d.statusChip[status]}
                </Badge>,
              ]}
            />
            <p className="mt-2 max-w-2xl text-sm text-fg-secondary">{d.status[status]}</p>
            <p className="mt-4 text-sm text-fg-muted" data-testid="trust-line">{d.trust.line}</p>
          </Section>

          <FaqSection locale={locale} />
        </LandingPage>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}

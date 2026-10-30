import { Button } from "@krizaka/ui/button";
import { PricingPage, type PricingPlan } from "@krizaka/ui/pricing-page";
import type { Metadata } from "next";

import { systemClock } from "@/app/system-clock";
import { ButtonLink } from "@/components/ButtonLink";
import { PlannedFeatures } from "@/components/pricing/PlannedFeatures";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { pageSession } from "@/lib/access";
import { founderSeats } from "@/lib/billing";
import { jsonLdHtml } from "@/lib/csp";
import { query } from "@/lib/db";
import { env } from "@/lib/env";
import { founderCap, founderEntry, onSale } from "@/lib/founder-offer";
import { asLocale, format, getDictionary } from "@/lib/i18n";
import { heroActions } from "@/lib/landing";
import { appPrices, publicPrices } from "@/lib/price-catalogue";
import { pricingPlans } from "@/lib/pricing-view";
import { accountRoutes } from "@/lib/routes";
import { pageMetadata, siteJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return pageMetadata(asLocale((await params).locale), "pricing");
}

/**
 * The prices, read from the catalogue at the date of the request (akinaza#380; the administrator's `/console/prices`): a price
 * changed there changes this page. The founder offer shows only while it is on sale, as on the home. What is not built says
 * « soon », with no figure. The action follows the home's: the demo shop and the sign-in while sign-up is closed.
 */
export default async function Pricing({ params }: Readonly<{ params: Promise<{ locale: string }> }>) {
  const locale = asLocale((await params).locale);
  const t = getDictionary(locale);
  const d = t.pricing;
  const catalogue = appPrices();
  const now = systemClock.now();
  const entry = await founderEntry(catalogue, now);
  const founderOnSale = env().APP_FOUNDER_OFFER_ENABLED && onSale(entry) && (await founderSeats(query, founderCap(entry))).open;
  const plans = pricingPlans(await publicPrices(catalogue, now), locale, { founderOnSale });
  const hero = heroActions(locale, Boolean(await pageSession().catch(() => null)));
  // One primary action on the page: the featured plan's. The others are secondary.
  const action = (founder: boolean, featured: boolean, association = false) =>
    founder ? (
      <form method="post" action={`/api/billing/checkout?redirect=1&locale=${locale}`}>
        <Button type="submit" variant="primary" size="md" shape="cut" className="w-full">
          {t.landing.founder.cta}
        </Button>
      </form>
    ) : (
      <ButtonLink href={association ? accountRoutes(locale).section("subscription") : hero.primary.href} variant={featured ? "primary" : "secondary"} size="md" shape="cut" className="w-full">
        {association ? d.associationCta : t.landing.actions[hero.primary.message]}
      </ButtonLink>
    );
  const badgeOf = (plan: (typeof plans)[number]) => {
    if (plan.id !== "founder") return undefined;
    return plan.limit ? format(d.badgeFounderLimit, { limit: plan.limit }) : d.badgeFounder;
  };
  // The free period and the Association plan, in the words of the catalogue's figures (the trial's length, the price after it); no urgency, no countdown.
  const trialWords = (plan: (typeof plans)[number]) => {
    if (!plan.trial) return null;
    return plan.trial.months ? format(d.trialMonths, { months: plan.trial.months }) : format(d.trialDays, { days: plan.trial.days });
  };
  const trialFeatures = (plan: (typeof plans)[number]): string[] => {
    const words = trialWords(plan);
    if (!plan.trial || !words || !plan.price) return [];
    if (plan.id !== "association") return [format(d.trialLine, { trial: words, price: plan.price })];
    return [plan.trial.months ? format(d.associationLine, { months: plan.trial.months, price: plan.price }) : format(d.associationLineDays, { days: plan.trial.days, price: plan.price }), d.associationHow];
  };
  const wording = (f: (typeof plans)[number]["features"][number]) => format(f.id === "inherits" ? d.features.inherits : d.features[f.id], f.id === "inherits" ? { plan: d.plans.starter } : f.vars);
  const cards: PricingPlan[] = plans.map((plan, i) => ({
    id: plan.id,
    name: d.plans[plan.id],
    price: plan.price ?? d.preparing,
    unit: plan.price === null ? undefined : d.perMonth,
    featured: i === 0,
    badge: badgeOf(plan),
    // The tick means « runs today »; what is planned is apart, under « Soon », with no tick.
    features: [...(plan.id === "founder" ? [d.founderNote] : []), ...trialFeatures(plan), ...plan.features.filter((f) => !f.soon).map(wording)],
    action: (
      <>
        <PlannedFeatures title={d.plannedTitle} soon={d.soon} items={plan.features.filter((f) => f.soon).map(wording)} />
        {action(plan.id === "founder", i === 0, plan.id === "association")}
      </>
    ),
  }));
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(siteJsonLd(locale)) }} />
      <SiteHeader locale={locale} current="pricing" />
      <main id="content" className="pt-20">
        <PricingPage brand="akinaza" title={d.title} lead={d.lead} plansLabel={d.plansLabel} plans={cards} faq={{ title: d.faqTitle, items: d.faq.map((f) => ({ question: f.q, answer: f.a })) }} />
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}

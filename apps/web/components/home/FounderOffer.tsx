import { CheckIcon } from "@krizaka/icons";
import { Button } from "@krizaka/ui/button";
import { Section } from "@krizaka/ui/page";
import Link from "next/link";

import { systemClock } from "@/app/system-clock";
import { founderSeats } from "@/lib/billing";
import { query } from "@/lib/db";
import { founderCap, founderEntry, founderOfferCopy, plansView } from "@/lib/founder-offer";
import { format, getDictionary, type Locale } from "@/lib/i18n";
import { appPrices, publicPrices } from "@/lib/price-catalogue";
import { contactHref, pagePath } from "@/lib/site";

/**
 * The founder offer: a limited offer with the setup included. Shown only when `APP_FOUNDER_OFFER_ENABLED`; every
 * figure — the price, the cap, the fees — is the catalogue's entry in force (akinaza#371), formatted with the locale, never
 * typed in a message. Starter and Scale B2B follow, each with its price from the catalogue. The button is a plain form (no script): it
 * opens the payment page, or the sign-in page when nobody is signed in.
 */
export async function FounderOffer({ locale }: Readonly<{ locale: Locale }>) {
  const t = getDictionary(locale).landing.founder;
  const catalogue = appPrices();
  const now = systemClock.now();
  const entry = await founderEntry(catalogue, now);
  const seats = await founderSeats(query, founderCap(entry));
  // The first businesses only: once they are all in, the page says the offer is complete and sells nothing.
  if (!seats.open) {
    return (
      <Section id="offer" title={t.full.title} lead={format(t.full.lead, { limit: seats.limit })} reveal divider>
        <Button asChild variant="secondary" size="lg" className="w-full sm:w-auto">
          <a href={contactHref("dev-akinaza-offer", locale)}>{t.talk}</a>
        </Button>
      </Section>
    );
  }
  const copy = founderOfferCopy(entry, locale);
  if (!copy) return null;
  const plans = plansView(await publicPrices(catalogue, now), locale);
  return (
    <Section id="offer" title={format(t.title, copy)} lead={t.lead} reveal divider>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {t.points.map((point) => (
          <li key={point} className="flex items-start gap-2 text-sm text-fg-secondary">
            <CheckIcon size={16} strokeWidth={2.25} className="mt-0.5 shrink-0 text-fg-accent" aria-hidden />
            {format(point, copy)}
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <form method="post" action={`/api/billing/checkout?redirect=1&locale=${locale}`}>
          <Button type="submit" variant="primary" size="lg" className="w-full sm:w-auto">
            {t.cta}
          </Button>
        </form>
        <Button asChild variant="secondary" size="lg" className="w-full sm:w-auto">
          <a href={contactHref("dev-akinaza-offer", locale)}>{t.talk}</a>
        </Button>
      </div>
      <p className="mt-3 max-w-2xl text-sm text-fg-secondary">{t.note}</p>
      <p className="mt-1 max-w-2xl text-sm text-fg-secondary" data-testid="terms-accept">
        {t.termsPrefix}
        <Link className="underline" href={pagePath(locale, "terms")}>
          {t.termsLink}
        </Link>
        .
      </p>
      <ul className="mt-6 flex list-none flex-col gap-1 p-0 text-sm text-fg-secondary">
        {plans.starter ? (
          <li>
            <strong className="text-fg">{t.plans.starter}</strong> · {plans.starter.price === null ? t.plans.preparing : format(t.plans.price, { price: plans.starter.price })}
          </li>
        ) : null}
        {plans.scale ? (
          <li>
            <strong className="text-fg">{t.plans.scale}</strong> · {plans.scale.price === null ? t.plans.preparing : format(t.plans.price, { price: plans.scale.price })} — {t.plans.scaleSoon}
          </li>
        ) : null}
      </ul>
    </Section>
  );
}

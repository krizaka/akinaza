import { CheckIcon } from "@krizaka/icons";
import { Button } from "@krizaka/ui/button";
import { Section } from "@krizaka/ui/page";

import { getDictionary, type Locale } from "@/lib/i18n";
import { contactHref } from "@/lib/site";

/**
 * The founder offer: a limited offer, 39 $ CAD a month with the setup included. Shown only when `APP_FOUNDER_OFFER_ENABLED`
 * (lib/landing.ts) — after a test-card checkout is proven. The button is a plain form (no script): it opens the payment page, or
 * the sign-in page when nobody is signed in. The amount itself is the processor's data (scripts/payments-setup.mjs).
 */
export function FounderOffer({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).landing.founder;
  return (
    <Section id="offer" eyebrow={t.eyebrow} title={t.title} lead={t.lead} reveal divider>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {t.points.map((point) => (
          <li key={point} className="flex items-start gap-2 text-sm text-fg-secondary">
            <CheckIcon size={16} strokeWidth={2.25} className="mt-0.5 shrink-0 text-fg-accent" aria-hidden />
            {point}
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
          <a href={contactHref("dev-akinaza-offer")}>{t.talk}</a>
        </Button>
      </div>
      <p className="mt-3 max-w-2xl text-sm text-fg-secondary">{t.note}</p>
    </Section>
  );
}

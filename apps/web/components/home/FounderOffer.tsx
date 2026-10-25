import { CheckIcon } from "@krizaka/icons";
import { Button } from "@krizaka/ui/button";
import { Section } from "@krizaka/ui/page";

import { founderSeats } from "@/lib/billing";
import { query } from "@/lib/db";
import { env } from "@/lib/env";
import { founderLimit, founderPrice } from "@/lib/founder-offer";
import { format, getDictionary, type Locale } from "@/lib/i18n";
import { paymentsFrom } from "@/lib/payments/config";
import { contactHref } from "@/lib/site";

/**
 * The founder offer: a limited offer with the setup included. Shown only when `APP_FOUNDER_OFFER_ENABLED` and the processor
 * answers: the price is read from it (by lookup key) and formatted with the locale, never typed in a message. The button is
 * a plain form (no script): it opens the payment page, or the sign-in page when nobody is signed in.
 */
export async function FounderOffer({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).landing.founder;
  const seats = await founderSeats(query, await founderLimit());
  // The first businesses only: once they are all in, the page says the offer is complete and sells nothing.
  if (!seats.open) {
    return (
      <Section id="offer" title={t.full.title} lead={format(t.full.lead, { limit: seats.limit })} reveal divider>
        <Button asChild variant="secondary" size="lg" className="w-full sm:w-auto">
          <a href={contactHref("dev-akinaza-offer")}>{t.talk}</a>
        </Button>
      </Section>
    );
  }
  const price = await founderPrice(paymentsFrom(env()), locale);
  if (!price) return null;
  const copy = { ...price, limit: seats.limit };
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
          <a href={contactHref("dev-akinaza-offer")}>{t.talk}</a>
        </Button>
      </div>
      <p className="mt-3 max-w-2xl text-sm text-fg-secondary">{t.note}</p>
    </Section>
  );
}

// @template: app-settings
import { redirect } from "next/navigation";

import { systemClock } from "@/app/system-clock";
import { ProfileFrame } from "@/components/account/ProfileFrame";
import { SubscriptionPanel } from "@/components/account/SubscriptionPanel";
import { accountPage } from "@/lib/account-page";
import { founderGate, soldVersionOf, subscriptionOf } from "@/lib/billing";
import { query } from "@/lib/db";
import { env } from "@/lib/env";
import { founderCap, founderEntry,founderOfferCopy } from "@/lib/founder-offer";
import { asLocale } from "@/lib/i18n";
import { titleOf } from "@/lib/page-title";
import { appPrices } from "@/lib/price-catalogue";
import { priceText } from "@/lib/price-text";
import { accountRoutes } from "@/lib/routes";

export const dynamic = "force-dynamic";
export const generateMetadata = titleOf("profile");

/**
 * The subscription: its state, the price it was sold at (the catalogue's version kept with it, akinaza#371), the founder offer
 * while it is on sale (the catalogue's entry in force), and the hosted page where it is managed.
 */
export default async function Subscription({ params }: Readonly<{ params: Promise<{ locale: string }> }>) {
  const locale = asLocale((await params).locale);
  const { session, profile, sections } = await accountPage();
  // A manager or a staff member works in someone else's shop: no subscription of theirs to show (`accountSectionsFor`).
  if (!sections.includes("subscription")) redirect(accountRoutes(locale).profile);
  const e = env();
  const now = systemClock.now();
  const catalogue = appPrices();
  const entry = await founderEntry(catalogue, now);
  // The first businesses only: once the offer is complete a newcomer is told so, a founder is never turned away.
  const full = e.APP_FOUNDER_OFFER_ENABLED && (await founderGate(query, session.account.id, founderCap(entry))) === "full";
  const offer = e.APP_FOUNDER_OFFER_ENABLED && !full ? founderOfferCopy(entry, locale) : null;
  const [subscription, soldId] = await Promise.all([subscriptionOf(query, session.account.id, now), soldVersionOf(query, session.account.id)]);
  const sold = soldId ? await catalogue.version(soldId) : null;
  return (
    <ProfileFrame locale={locale} current="subscription" account={profile} sections={sections}>
      <SubscriptionPanel subscription={{ active: subscription.active, periodEnd: subscription.periodEnd, hasCustomer: subscription.customerId !== null, offer: offer ? { price: offer.price, cardRate: offer.cardRate } : null, offerFull: full, soldPrice: sold ? priceText(sold, locale) : null }} />
    </ProfileFrame>
  );
}

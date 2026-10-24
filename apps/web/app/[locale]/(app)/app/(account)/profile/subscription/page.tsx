// @template: app-settings
import { redirect } from "next/navigation";

import { ProfileFrame } from "@/components/account/ProfileFrame";
import { SubscriptionPanel } from "@/components/account/SubscriptionPanel";
import { accountPage } from "@/lib/account-page";
import { subscriptionOf } from "@/lib/billing";
import { query } from "@/lib/db";
import { env } from "@/lib/env";
import { founderPrice } from "@/lib/founder-offer";
import { asLocale } from "@/lib/i18n";
import { titleOf } from "@/lib/page-title";
import { paymentsFrom } from "@/lib/payments/config";
import { accountRoutes } from "@/lib/routes";

export const dynamic = "force-dynamic";
export const generateMetadata = titleOf("profile");

/** The subscription: its state, the founder offer while it is on sale, and the hosted page where it is managed. */
export default async function Subscription({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const { session, profile, sections } = await accountPage();
  // A manager or a staff member works in someone else's shop: no subscription of theirs to show (`accountSectionsFor`).
  if (!sections.includes("subscription")) redirect(accountRoutes(locale).profile);
  const e = env();
  const [subscription, offer] = await Promise.all([subscriptionOf(query, session.account.id, new Date()), e.APP_FOUNDER_OFFER_ENABLED ? founderPrice(paymentsFrom(e), locale) : null]);
  return (
    <ProfileFrame locale={locale} current="subscription" account={profile} sections={sections}>
      <SubscriptionPanel subscription={{ active: subscription.active, periodEnd: subscription.periodEnd, hasCustomer: subscription.customerId !== null, offer }} />
    </ProfileFrame>
  );
}

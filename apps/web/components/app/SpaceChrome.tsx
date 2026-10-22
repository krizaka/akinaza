import type { ShopRole } from "@akinaza/db";

import { AppFrame } from "@/components/app/AppFrame";
import { ShopSwitcher } from "@/components/app/ShopSwitcher";
import { CLIENT_PLACES, placesFor } from "@/lib/app-nav";
import { VocabularyProvider } from "@/lib/i18n-client";
import { shopsOf } from "@/lib/member-shop";
import { accountRoutes, placeHref, type RouteLocale } from "@/lib/routes";

type Membership = { shop: { id: string; businessType: Parameters<typeof VocabularyProvider>[0]["type"] }; role: ShopRole } | null;

/** The frame of the signed-in space: the bar shows what the role may open, each place leads into the shop in use, the switcher lists the others. */
export async function SpaceChrome({ locale, account, member, children }: { locale: RouteLocale; account: { id: string; email: string }; member: Membership; children: React.ReactNode }) {
  const shops = member ? await shopsOf(account.id) : [];
  const places = member ? placesFor(member.role) : [...CLIENT_PLACES];
  const hrefs = Object.fromEntries(places.map((place) => [place, placeHref(locale, member?.shop.id ?? null, place)]));
  return (
    <AppFrame
      locale={locale}
      email={account.email}
      base={accountRoutes(locale).home}
      items={places}
      hrefs={hrefs}
      switcher={member ? <ShopSwitcher locale={locale} shops={shops} currentId={member.shop.id} /> : undefined}
    >
      {member ? <VocabularyProvider type={member.shop.businessType}>{children}</VocabularyProvider> : children}
    </AppFrame>
  );
}

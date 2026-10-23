import type { ShopRole } from "@akinaza/db";

import { accounts } from "@/app/accounts";
import { ShopFrame } from "@/components/app/ShopFrame";
import { CLIENT_PLACES, placeHrefFor, placesFor } from "@/lib/app-nav";
import { VocabularyProvider } from "@/lib/i18n-client";
import { indexable } from "@/lib/indexing";
import { may, shopsOf } from "@/lib/member-shop";
import { accountRoutes, type RouteLocale, shopRoutes } from "@/lib/routes";

type Membership = { shop: { id: string; name: string; businessType: Parameters<typeof VocabularyProvider>[0]["type"] }; role: ShopRole } | null;

/**
 * The frame of the signed-in space: the rail shows what the role may open, each place leads into the shop in use, the header
 * names that shop (and lists the others), carries the one primary action for who may issue invoices, and the account menu.
 * A client (no shop) gets the same frame around their bookings.
 */
export async function SpaceChrome({ locale, account, member, children }: { locale: RouteLocale; account: { id: string; email: string }; member: Membership; children: React.ReactNode }) {
  const profile = await accounts().profile(account.id);
  const shops = member ? await shopsOf(account.id) : [];
  const places = member ? placesFor(member.role) : [...CLIENT_PLACES];
  const membership = member ? { shopId: member.shop.id, role: member.role } : null;
  const routes = member ? shopRoutes(locale, member.shop.id) : null;
  return (
    <ShopFrame
      locale={locale}
      account={{ email: account.email, name: profile.name, avatarSeed: profile.avatarSeed }}
      places={places.map((place) => ({ key: place, href: placeHrefFor(locale, membership, place) }))}
      shop={member && routes ? { current: { id: member.shop.id, name: member.shop.name }, others: shops.filter((s) => s.id !== member.shop.id).map((s) => ({ id: s.id, name: s.name })), addHref: may(member.role, "settings") ? `${routes.setup}/new` : null } : undefined}
      newInvoiceHref={member && routes && may(member.role, "invoices") ? routes.newInvoice : null}
      dev={!indexable()}
      home={accountRoutes(locale).home}
      profileHref={accountRoutes(locale).profile}
    >
      {member ? <VocabularyProvider type={member.shop.businessType}>{children}</VocabularyProvider> : children}
    </ShopFrame>
  );
}

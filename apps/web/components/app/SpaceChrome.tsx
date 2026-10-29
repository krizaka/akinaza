import { frameCounts, shopDay, type ShopRole } from "@akinaza/db";

import { accounts } from "@/app/accounts";
import { ShopFrame } from "@/components/app/ShopFrame";
import { agendaScope } from "@/lib/access";
import { CLIENT_PLACES, placeHrefFor, placesFor } from "@/lib/app-nav";
import { db } from "@/lib/db";
import { VocabularyProvider } from "@/lib/i18n-client";
import { indexable } from "@/lib/indexing";
import { may, shopsOf } from "@/lib/member-shop";
import { accountRoutes, type RouteLocale, shopRoutes } from "@/lib/routes";

type Membership = { shop: { id: string; name: string; businessType: Parameters<typeof VocabularyProvider>[0]["type"] }; role: ShopRole } | null;

/**
 * The frame of the signed-in space: the rail shows what the role may open, each place leads into the shop in use, the header
 * names that shop (and lists the others), carries the search (⌘K), the lists' primary action for who may issue invoices, and the
 * account menu; the rail counts the day's appointments and the invoices to collect.
 * A client (no shop) gets the same frame around their bookings.
 */
export async function SpaceChrome({ locale, account, member, children }: Readonly<{ locale: RouteLocale; account: { id: string; email: string }; member: Membership; children: React.ReactNode }>) {
  const profile = await accounts().profile(account.id);
  const routes = accountRoutes(locale);
  const common = { locale, account: { id: account.id, email: account.email, name: profile.name, avatarSeed: profile.avatarSeed }, dev: !indexable(), home: routes.home, profileHref: routes.profile };
  if (!member) {
    const places = [...CLIENT_PLACES].map((place) => ({ key: place, href: placeHrefFor(locale, null, place), also: undefined }));
    return <ShopFrame {...common} places={places} shop={undefined} newInvoiceHref={null} search={false} counts={undefined}>{children}</ShopFrame>;
  }
  const shops = await shopsOf(account.id);
  const shopRoutesOf = shopRoutes(locale, member.shop.id);
  const membership = { shopId: member.shop.id, role: member.role };
  const mayInvoice = may(member.role, "invoices");
  // The rail's counts: the day's appointments (a staff member's own), the invoices to collect for who may see them.
  const counts = await frameCounts(db(), member.shop.id, { day: await shopDay(db(), member.shop.id, new Date()), ...agendaScope(member.role, account.id) });
  return (
    <ShopFrame
      {...common}
      places={placesFor(member.role).map((place) => ({ key: place, href: placeHrefFor(locale, membership, place), also: place === "shop" ? [shopRoutesOf.team] : undefined }))}
      shop={{ current: { id: member.shop.id, name: member.shop.name }, others: shops.filter((s) => s.id !== member.shop.id).map((s) => ({ id: s.id, name: s.name })), addHref: may(member.role, "settings") ? `${shopRoutesOf.setup}/new` : null }}
      newInvoiceHref={mayInvoice ? shopRoutesOf.newInvoice : null}
      search={may(member.role, "clients") || mayInvoice}
      counts={{ today: counts.appointments, toCollect: mayInvoice ? counts.toCollect : undefined }}
    >
      <VocabularyProvider type={member.shop.businessType}>{children}</VocabularyProvider>
    </ShopFrame>
  );
}

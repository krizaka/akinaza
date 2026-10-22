/**
 * Every address of the signed-in space, from one place. The shop a person works in is in the path (`/app/<shop>/…`), so a link
 * can be shared, opened in another tab on another shop, and read in the history; nothing builds an `/app/…` string by hand.
 */
import type { AppPlace } from "./app-nav";
import { isShopId } from "./shop-id";

export { isShopId };

export type RouteLocale = "en" | "fr";

const query = (params: Record<string, string | undefined>) => {
  const text = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => entry[1] !== undefined)).toString();
  return text ? `?${text}` : "";
};

/** The addresses of one shop's space. */
export function shopRoutes(locale: RouteLocale, shopId: string) {
  const root = `/${locale}/app/${shopId}`;
  return {
    root,
    today: (day?: string, appointment?: string) => `${root}/aujourdhui${query({ day, appointment })}`,
    clients: `${root}/clients`,
    client: (id: string) => `${root}/clients/${id}`,
    invoices: `${root}/invoices`,
    invoice: (id: string) => `${root}/invoices/${id}`,
    newInvoice: `${root}/invoices/new`,
    books: (period?: string) => `${root}/books${query({ period })}`,
    team: `${root}/team`,
    setup: `${root}/shop`,
    /** An API address of the shop's space, for the shop of the page: the routes pick the shop with `?shopId=`. */
    api: (path: string) => `${path}${path.includes("?") ? "&" : "?"}shopId=${shopId}`,
  };
}

export type ShopRoutes = ReturnType<typeof shopRoutes>;

/** The addresses that belong to the account, not to a shop. */
export const accountRoutes = (locale: RouteLocale) => ({ home: `/${locale}/app`, profile: `/${locale}/app/profile`, security: `/${locale}/app/profile/security` });

/** Where each place of the bar leads, for a person working in `shopId` (or in none: a client). */
export function placeHref(locale: RouteLocale, shopId: string | null, place: AppPlace): string {
  const account = accountRoutes(locale);
  if (place === "profile") return account.profile;
  if (place === "bookings" || shopId === null) return account.home;
  const shop = shopRoutes(locale, shopId);
  const hrefs: Record<Exclude<AppPlace, "profile" | "bookings">, string> = { today: shop.today(), clients: shop.clients, invoices: shop.invoices, books: shop.books(), team: shop.team, shop: shop.setup };
  return hrefs[place];
}

/** The same page in another shop: only the shop segment changes when the page is not about one record, else the other shop's day. */
export function inOtherShop(locale: RouteLocale, pathname: string, from: string, to: string): string {
  const prefix = `/${locale}/app/${from}/`;
  if (!pathname.startsWith(prefix)) return shopRoutes(locale, to).today();
  const rest = pathname.slice(prefix.length);
  const aboutARecord = /^(clients|invoices)\/(?!new$)[^/]+/.test(rest);
  return aboutARecord ? shopRoutes(locale, to).today() : `/${locale}/app/${to}/${rest}`;
}

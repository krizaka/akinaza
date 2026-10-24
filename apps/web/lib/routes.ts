/**
 * Every address of the signed-in space, from one place. The shop a person works in is in the path (`/app/<shop>/…`), so a link
 * can be shared, opened in another tab on another shop, and read in the history; nothing builds an `/app/…` string by hand.
 */
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
    /** « Le point du lundi » in full; Today only announces it. */
    brief: `${root}/brief`,
    clients: `${root}/clients`,
    client: (id: string) => `${root}/clients/${id}`,
    invoices: `${root}/invoices`,
    invoice: (id: string) => `${root}/invoices/${id}`,
    /** « Modifier » (#207): the replacement of an issued invoice, prefilled. */
    invoiceCorrect: (id: string) => `${root}/invoices/${id}/correct`,
    newInvoice: `${root}/invoices/new`,
    books: (period?: string) => `${root}/books${query({ period })}`,
    /** Boutique (K4): one hub on SettingsLayout, one address per section; `?tab=` names the section of the page. */
    boutique: (section?: string, tab?: string) => `${root}/boutique${section ? `/${section}` : ""}${query({ tab })}`,
    /** Boutique › Équipe. */
    team: `${root}/boutique/team`,
    /** Boutique › Page, the first section of the hub (« Ma page boutique »). */
    setup: `${root}/boutique/page`,
    /** Boutique › Shops: « Add a shop » (one more shop under the same account). */
    addShop: `${root}/shop/new`,
    /** An API address of the shop's space, for the shop of the page: the routes pick the shop with `?shopId=`. */
    api: (path: string) => `${path}${path.includes("?") ? "&" : "?"}shopId=${shopId}`,
  };
}

export type ShopRoutes = ReturnType<typeof shopRoutes>;

/** The addresses that belong to the account, not to a shop. */
export const ACCOUNT_SECTIONS = ["profile", "preferences", "security", "subscription", "data"] as const;
export type AccountSection = (typeof ACCOUNT_SECTIONS)[number];

export const accountRoutes = (locale: RouteLocale) => ({
  home: `/${locale}/app`,
  profile: `/${locale}/app/profile`,
  /** « Ouvrir une boutique »: a client's first shop — an action of the client space, never a place on the rail (K7). */
  openShop: `/${locale}/app/open-shop`,
  /** One of the client's own invoices, whichever shop issued it. */
  invoice: (id: string) => `/${locale}/app/invoices/${id}`,
  /** One section of the account: the first is the profile itself, the others are below it. */
  section: (id: AccountSection) => (id === "profile" ? `/${locale}/app/profile` : `/${locale}/app/profile/${id}`),
});

/** The same page in another shop: only the shop segment changes when the page is not about one record, else the other shop's day. */
export function inOtherShop(locale: RouteLocale, pathname: string, from: string, to: string): string {
  const prefix = `/${locale}/app/${from}/`;
  if (!pathname.startsWith(prefix)) return shopRoutes(locale, to).today();
  const rest = pathname.slice(prefix.length);
  const aboutARecord = /^(clients|invoices)\/(?!new$)[^/]+/.test(rest);
  return aboutARecord ? shopRoutes(locale, to).today() : `/${locale}/app/${to}/${rest}`;
}

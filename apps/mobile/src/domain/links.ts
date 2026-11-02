/**
 * The URL is the state (addendum 2026-10-17): every screen has the path the web's owner space has, under the language, so a link to
 * the web opens the app when it is installed and a deep link opens the web.
 */
export type Locale = "fr" | "en";
export const LOCALES: readonly Locale[] = ["fr", "en"];
export const DEFAULT_LOCALE: Locale = "fr";

export const asLocale = (value: string | null | undefined): Locale => LOCALES.find((l) => l === value?.slice(0, 2)) ?? DEFAULT_LOCALE;

const app = (locale: Locale, ...parts: string[]) => ["", locale, "app", ...parts].join("/");
const query = (params: Record<string, string | undefined>) => {
  const pairs = Object.entries(params).filter((e): e is [string, string] => !!e[1]);
  const joined = pairs.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  return pairs.length ? `?${joined}` : "";
};

/**
 * Where to go after signing in: the screen a signed-out link asked for, when it is one of the app's own (`/fr/app…`,
 * `/en/app…`, never another host or `//…`), else the app's first screen.
 */
export function safeNext(next: string | undefined, locale: Locale): string {
  if (next && /^\/(fr|en)\/app(\/|\?|$)/.test(next) && !next.includes("//") && !next.includes("\\")) return next;
  return routes.home(locale);
}

/**
 * Every screen at the web's address (apps/web `lib/routes.ts`, `shopRoutes`): the shop in the path, the state in the query (D8).
 * `home` is the app's first screen: it opens the member's shop. The profile is the account's, not a shop's.
 */
export const routes = {
  home: (locale: Locale) => app(locale),
  today: (locale: Locale, shop: string, day?: string) => `${app(locale, shop, "today")}${query({ day })}`,
  clients: (locale: Locale, shop: string, search?: string) => `${app(locale, shop, "clients")}${query({ q: search })}`,
  invoices: (locale: Locale, shop: string) => app(locale, shop, "invoices"),
  newInvoice: (locale: Locale, shop: string, client?: string) => `${app(locale, shop, "invoices", "new")}${query({ client })}`,
  books: (locale: Locale, shop: string, period?: string) => `${app(locale, shop, "books")}${query({ period })}`,
  figures: (locale: Locale, shop: string) => app(locale, shop, "figures"),
  boutique: (locale: Locale, shop: string) => app(locale, shop, "settings"),
  boutiqueSection: (locale: Locale, shop: string, section: string) => app(locale, shop, "settings", section),
  profile: (locale: Locale) => app(locale, "profile"),
} as const;

/** The five places of the shop, in the web rail's order and words (D8): the tab bar is built from it. */
export const TABS = [
  { name: "today", label: "tabs.today", href: (locale: Locale, shop: string) => routes.today(locale, shop) },
  { name: "clients", label: "tabs.clients", href: (locale: Locale, shop: string) => routes.clients(locale, shop) },
  { name: "invoices", label: "tabs.invoices", href: (locale: Locale, shop: string) => routes.invoices(locale, shop) },
  { name: "books", label: "tabs.books", href: (locale: Locale, shop: string) => routes.books(locale, shop) },
  { name: "settings", label: "tabs.boutique", href: (locale: Locale, shop: string) => routes.boutique(locale, shop) },
] as const;
export type TabName = (typeof TABS)[number]["name"];

/** The app's addresses before D8 (`/fr/app/calendar`, `/fr/app/settings`…), kept so an old link still lands somewhere true. */
export const LEGACY = ["calendar", "clients", "invoices", "invoices/new", "settings"] as const;
export type Legacy = (typeof LEGACY)[number];

export function legacyRoute(locale: Locale, from: Legacy, shop: string): string {
  const to: Record<Legacy, string> = {
    calendar: routes.today(locale, shop),
    clients: routes.clients(locale, shop),
    invoices: routes.invoices(locale, shop),
    "invoices/new": routes.newInvoice(locale, shop),
    settings: routes.profile(locale),
  };
  return to[from];
}

/** The groups of the web's Boutique (apps/web `lib/boutique.ts`), with the section each row opens there: the long forms are a desk's. */
export const BOUTIQUE_GROUPS = [
  { id: "page", sections: ["page", "languages"] },
  { id: "business", sections: ["hours", "rules", "team", "invoices", "agenda", "figures", "data"] },
] as const;

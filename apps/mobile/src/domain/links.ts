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
  return pairs.length ? `?${pairs.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}` : "";
};

/**
 * Where to go after signing in: the screen a signed-out link asked for, when it is one of the app's own (`/fr/app…`,
 * `/en/app…`, never another host or `//…`), else Today.
 */
export function safeNext(next: string | undefined, locale: Locale): string {
  if (next && /^\/(fr|en)\/app(\/|\?|$)/.test(next) && !next.includes("//") && !next.includes("\\")) return next;
  return routes.today(locale);
}

export const routes = {
  today: (locale: Locale, date?: string) => `${app(locale)}${query({ date })}`,
  calendar: (locale: Locale, month?: string) => `${app(locale, "calendar")}${query({ month })}`,
  invoices: (locale: Locale) => app(locale, "invoices"),
  newInvoice: (locale: Locale, client?: string) => `${app(locale, "invoices", "new")}${query({ client })}`,
  clients: (locale: Locale, search?: string) => `${app(locale, "clients")}${query({ q: search })}`,
  settings: (locale: Locale) => app(locale, "settings"),
} as const;

import type { Locale } from "@/lib/i18n";

/** The addresses of the booking journey (the URL is the state), kept apart from the views so the pages and the shop view share them. */
export const journeyBase = (locale: Locale, slug: string) => `/${locale}/s/${slug}`;
/** The two choices a visitor may make on the way: a person (or anyone) and, for a shop that travels, an area. Both live in the address. */
export interface Choice {
  staffId?: string | null;
  zoneId?: string | null;
}
const query = (c: Choice) => {
  const q = [c.staffId ? `staff=${c.staffId}` : "", c.zoneId ? `zone=${c.zoneId}` : ""].filter(Boolean).join("&");
  return q ? `?${q}` : "";
};
export const serviceHref = (locale: Locale, slug: string, serviceId: string, c: Choice = {}) => `${journeyBase(locale, slug)}/service/${serviceId}${query(c)}`;
export const timesHref = (locale: Locale, slug: string, serviceId: string, c: Choice = {}) => `${journeyBase(locale, slug)}/service/${serviceId}/creneau${query(c)}`;


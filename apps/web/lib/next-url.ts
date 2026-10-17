import { searchValue } from "@/lib/booking-defaults";

/** Where sign-in may send the visitor back to: a page of this site in their language, a plain query string allowed (the choice made on the shop page), nothing else. */
export function safeNext(wanted: string | undefined, locale: string): string {
  const fallback = `/${locale}/app`;
  if (!wanted || wanted.includes("//") || wanted.includes("..")) return fallback;
  return new RegExp(`^/${locale}/[A-Za-z0-9/_.-]*(\\?[A-Za-z0-9=&%_.:-]*)?$`).test(wanted) ? wanted : fallback;
}

/** The address of a page with its query, to come back to after sign-in (empty values left out, the first of a repeated one). */
export function backToHere(path: string, query: Record<string, string | string[] | undefined>): string {
  const pairs = Object.entries(query).flatMap(([key, value]) => {
    const one = searchValue(value);
    return one ? [[key, one] as [string, string]] : [];
  });
  return pairs.length ? `${path}?${new URLSearchParams(pairs).toString()}` : path;
}

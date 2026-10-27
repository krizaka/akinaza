import { defineKeys, queryOptions } from "@krizaka/query";

import type { AkinazaApi } from "./api";

/** The shop's part of a key: the address's shop, or the server's default one before the app knows it. */
const of = (shopId: string | undefined) => shopId ?? "default";

/**
 * One module for the server state: the keys and the queries, so a screen reads and an action invalidates the same names. Every
 * key of the shop's space carries the shop (D8): two shops never share a cache entry.
 */
export const keys = defineKeys("akinaza", {
  day: (date: string | undefined, shopId?: string) => [of(shopId), date ?? "today"],
  calendar: (from: string, to: string, shopId?: string) => [of(shopId), from, to],
  clients: (shopId?: string) => [of(shopId)],
  invoices: (shopId?: string) => [of(shopId)],
  shop: (shopId?: string) => [of(shopId)],
  books: (period: string | undefined, shopId?: string) => [of(shopId), period ?? "latest"],
  figures: (shopId?: string) => [of(shopId)],
  me: () => [],
});

// @fixed: a screen that shows today refreshes a booking made by a client within the minute
const DAY_STALE_MS = 30_000;

export function createQueries(api: AkinazaApi) {
  return {
    me: () => queryOptions({ queryKey: keys.me(), queryFn: api.me }),
    /** The owner's day: today in the shop's time zone when `date` is omitted. */
    day: (date?: string, shopId?: string) => queryOptions({ queryKey: keys.day(date, shopId), queryFn: () => api.day(date, shopId), staleTime: DAY_STALE_MS }),
    calendar: (from: string, to: string, shopId?: string) => queryOptions({ queryKey: keys.calendar(from, to, shopId), queryFn: () => api.calendar(from, to, shopId) }),
    clients: (shopId?: string) => queryOptions({ queryKey: keys.clients(shopId), queryFn: () => api.clients(shopId) }),
    invoices: (shopId?: string) => queryOptions({ queryKey: keys.invoices(shopId), queryFn: () => api.invoices(shopId) }),
    shop: (shopId?: string) => queryOptions({ queryKey: keys.shop(shopId), queryFn: () => api.shop(shopId) }),
    books: (period?: string, shopId?: string) => queryOptions({ queryKey: keys.books(period, shopId), queryFn: () => api.books(period, shopId) }),
    figures: (shopId?: string) => queryOptions({ queryKey: keys.figures(shopId), queryFn: () => api.figures(shopId) }),
  };
}

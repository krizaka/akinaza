import { defineKeys, queryOptions } from "@krizaka/query";

import type { AkinazaApi } from "./api";

/** One module for the server state: the keys and the queries, so a screen reads and an action invalidates the same names. */
export const keys = defineKeys("akinaza", {
  day: (date: string | undefined) => [date ?? "today"],
  calendar: (from: string, to: string) => [from, to],
  clients: () => [],
  invoices: () => [],
  shop: () => [],
});

// @fixed: a screen that shows today refreshes a booking made by a client within the minute
const DAY_STALE_MS = 30_000;

export function createQueries(api: AkinazaApi) {
  return {
    /** The owner's day: today in the shop's time zone when `date` is omitted. */
    day: (date?: string) => queryOptions({ queryKey: keys.day(date), queryFn: () => api.day(date), staleTime: DAY_STALE_MS }),
    calendar: (from: string, to: string) => queryOptions({ queryKey: keys.calendar(from, to), queryFn: () => api.calendar(from, to) }),
    clients: () => queryOptions({ queryKey: keys.clients(), queryFn: api.clients }),
    invoices: () => queryOptions({ queryKey: keys.invoices(), queryFn: api.invoices }),
    shop: () => queryOptions({ queryKey: keys.shop(), queryFn: api.shop }),
  };
}

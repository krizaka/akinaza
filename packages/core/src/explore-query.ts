import { z } from "zod";

/** The kinds of shop a visitor may filter on (the `shops.kind` column). */
export const EXPLORE_KINDS = ["salon", "boutique", "services", "other"] as const;
/** « Open now », « open in the next 7 days », « a free time today ». */
export const EXPLORE_OPEN = ["now", "week", "free-today"] as const;
/** The radius choices, in km (the admin may narrow the list: ADR-006 decision 9). */
export const EXPLORE_RADII = [1, 3, 10, 25] as const;
// @fixed: the endpoint serves 200 shops at most per page (it answered up to 200 before the filters existed; the filter bar of slice 5 asks for 30)
export const EXPLORE_MAX_LIMIT = 200;

const lng = z.number().min(-180).max(180);
const lat = z.number().min(-90).max(90);

/**
 * ADR-006 decision 3: one typed filter schema for the URL, the request and the cache key. Groups combine with AND, the values
 * of a group with OR. Unknown keys are refused. (The service-type and price-band filters wait for a catalogue to filter on:
 * today a service has a name, not a type, so the text search covers service names.)
 */
export const exploreQuerySchema = z
  .strictObject({
    q: z.string().trim().min(2).max(60).optional(),
    kinds: z.array(z.enum(EXPLORE_KINDS)).min(1).max(EXPLORE_KINDS.length).optional(),
    open: z.enum(EXPLORE_OPEN).optional(),
    near: z.tuple([lng, lat]).optional(),
    within: z.union(EXPLORE_RADII.map((r) => z.literal(r)) as unknown as [z.ZodLiteral<1>, z.ZodLiteral<3>, z.ZodLiteral<10>, z.ZodLiteral<25>]).optional(),
    bbox: z.tuple([lng, lat, lng, lat]).refine(([w, s, e, n]) => w < e && s < n, "bbox is [west, south, east, north]").optional(),
    limit: z.number().int().min(1).max(EXPLORE_MAX_LIMIT).default(EXPLORE_MAX_LIMIT),
    /** Where the page starts (offset in the stable order); opaque to the caller, which passes back `next`. */
    offset: z.number().int().min(0).max(10_000).default(0),
  })
  .refine((q) => q.within === undefined || q.near !== undefined, { message: "within needs near", path: ["within"] });

export type ExploreQuery = z.infer<typeof exploreQuerySchema>;

const numbers = (value: string) => value.split(",").map((part) => (part.trim() === "" ? Number.NaN : Number(part)));

/** The URL's `?q=&kind=hair,nails&open=week&near=lng,lat&within=3&bbox=w,s,e,n&limit=&offset=` as a validated query (a ZodError says what is wrong). */
export function parseExploreParams(params: URLSearchParams): ExploreQuery {
  const raw: Record<string, unknown> = {};
  for (const key of new Set(params.keys())) {
    const value = params.get(key)!;
    if (key === "kind") raw.kinds = value.split(",");
    else if (key === "near" || key === "bbox") raw[key] = numbers(value);
    else if (key === "within" || key === "limit" || key === "offset") raw[key] = Number(value);
    else raw[key] = value;
  }
  return exploreQuerySchema.parse(raw);
}

/** The words of a text search as lower-case letters and digits without accents (what the index holds): never anything else reaches the query. */
export function searchTokens(q: string): string[] {
  return (q.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).slice(0, 8);
}

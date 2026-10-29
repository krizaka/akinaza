import { type ExploreQuery, exploreQuerySchema, type ExploreShop, searchTokens } from "@akinaza/core";
import { and, type SQL, sql } from "drizzle-orm";

import type { Db } from "./client";
import { listSlots } from "./service-shop";

// @fixed: a shop's « free slot today » is read from its first services only, each one query
const SERVICES_CHECKED = 3;
// @fixed: how many shops' free times are computed at once (the slot engine is the one costly fact)
const SLOT_CONCURRENCY = 8;
const EARTH_RADIUS_M = 6_371_000;
const KM_PER_DEGREE = 111.32;

/** What an Explorer page answers: the shops (with their distance from `near`, when given) and where the next page starts. */
export type ExploreShopResult = ExploreShop & { distanceMeters: number | null };
export interface ExplorePage { shops: ExploreShopResult[]; next: number | null }

/** The shop's local clock at `now`, in SQL: the instant is a bound value (the injected clock), the zone is the shop's own. */
const localNow = (now: Date) => sql`(${now.toISOString()}::timestamptz AT TIME ZONE s.timezone)`;

/** The shop has someone with a weekly window open at this local minute, and not off that day (the rule of `isOpenNow`, per person). */
const openNowSql = (now: Date) => sql`EXISTS (
  SELECT 1 FROM staff st JOIN schedules sc ON sc.staff_id = st.id
  WHERE st.shop_id = s.shop_id AND st.active
    AND sc.weekday = EXTRACT(dow FROM ${localNow(now)})::int
    AND sc.starts_at <= ${localNow(now)}::time AND ${localNow(now)}::time < sc.ends_at
    AND NOT EXISTS (SELECT 1 FROM days_off d WHERE d.staff_id = st.id AND d.on_date = ${localNow(now)}::date))`;

/** A window still to come in the next `days` local days (today counts only until its window ends), not a day off. */
const windowAheadSql = (now: Date, days: number) => sql`EXISTS (
  SELECT 1 FROM generate_series(0, ${days - 1}) k
  CROSS JOIN LATERAL (SELECT ${localNow(now)}::date + k AS day) x
  JOIN staff st ON st.shop_id = s.shop_id AND st.active
  JOIN schedules sc ON sc.staff_id = st.id AND sc.weekday = EXTRACT(dow FROM x.day)::int
  WHERE (k > 0 OR sc.ends_at > ${localNow(now)}::time)
    AND NOT EXISTS (SELECT 1 FROM days_off d WHERE d.staff_id = st.id AND d.on_date = x.day))`;

/** Haversine distance in metres from `origin` to the shop's position (null when the shop has none). */
const distanceSql = ([lng, lat]: readonly [number, number]) => sql`(2 * ${EARTH_RADIUS_M} * asin(sqrt(least(1,
  power(sin(radians(s.lat - ${lat}) / 2), 2) + cos(radians(${lat})) * cos(radians(s.lat)) * power(sin(radians(s.lng - ${lng}) / 2), 2)))))`;

export interface CompiledExplore { conditions: SQL[]; distance: SQL | null }

/**
 * ADR-006 decision 3: the filters of an `ExploreQuery` as parameterised SQL conditions over `shop_search` (alias `s`), combined with
 * AND. Every value is a bound parameter; the only text built here is the fixed SQL and the search words, reduced to letters and
 * digits by `searchTokens` first. The clock is the one given, never the database's.
 */
export function compileExplore(query: ExploreQuery, now: Date): CompiledExplore {
  // A page that cannot be served (no booking rules or no worker yet) is not listed: its public page would refuse.
  const conditions: SQL[] = [
    sql`EXISTS (SELECT 1 FROM shop_rules r WHERE r.shop_id = s.shop_id)`,
    sql`EXISTS (SELECT 1 FROM staff st WHERE st.shop_id = s.shop_id AND st.active)`,
  ];
  if (query.q) {
    const words = searchTokens(query.q);
    if (words.length > 0) {
      const prefixes = words.map((w) => `${w}:*`).join(" & ");
      conditions.push(sql`(s.search @@ to_tsquery('simple', ${prefixes}) OR ${words.join(" ")} <% s.name_norm)`);
    }
  }
  if (query.kinds) conditions.push(sql`s.kind IN (${sql.join(query.kinds.map((k) => sql`${k}`), sql`, `)})`);
  if (query.open === "now") conditions.push(openNowSql(now));
  if (query.open === "week") conditions.push(windowAheadSql(now, 7));
  // The free time itself is read after (the slot engine); here only the shops with a window left today are candidates.
  if (query.open === "free-today") conditions.push(windowAheadSql(now, 1));
  if (query.bbox) {
    const [w, south, e, n] = query.bbox;
    conditions.push(sql`s.pt <@ box(point(${w}, ${south}), point(${e}, ${n}))`);
  }
  const distance = query.near ? distanceSql(query.near) : null;
  if (query.near && query.within) {
    const [lng, lat] = query.near;
    const dLat = query.within / KM_PER_DEGREE;
    const dLng = query.within / (KM_PER_DEGREE * Math.max(0.01, Math.cos((lat * Math.PI) / 180)));
    // The box lets the GiST index choose the few shops; the exact distance decides.
    conditions.push(sql`s.pt <@ box(point(${lng - dLng}, ${lat - dLat}), point(${lng + dLng}, ${lat + dLat}))`);
    conditions.push(sql`${distance} <= ${query.within * 1000}`);
  }
  return { conditions, distance };
}

interface Row extends Record<string, unknown> {
  shop_id: string; slug: string; name: string; kind: ExploreShop["kind"]; area: string | null; tagline_fr: string | null; tagline_en: string | null;
  timezone: string; quartiers: string[]; lat: number | null; lng: number | null; open_now: boolean; window_left: boolean; distance_m: number | null;
}

/** Runs `work` over `items`, at most `size` at a time, keeping the order. */
async function inBatches<T, R>(items: readonly T[], size: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(work))));
  return out;
}

// @fixed: the answers kept at most; the oldest go first
const FREE_TODAY_KEPT = 5_000;
const freeTodayCache = new Map<string, boolean>();

/** Forgets the remembered answers (a test starts clean). */
export function forgetFreeToday(): void { freeTodayCache.clear(); }

/** Does the shop have a free time today? The services are tried in order, the first free one answers; the answer is kept for the clock minute it was read in (ADR-006 decision 4: the slot engine is the one costly fact of the page). */
async function freeToday(db: Db, shopId: string, timezone: string, now: Date): Promise<boolean> {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const key = `${shopId}|${today}|${now.toISOString().slice(0, 16)}`; // the given clock's minute: the clock is injected, never read here
  const kept = freeTodayCache.get(key);
  if (kept !== undefined) return kept;
  const rows = (await db.execute(sql`SELECT id FROM services WHERE shop_id = ${shopId} AND active ORDER BY duration_minutes, name_en LIMIT ${SERVICES_CHECKED}`)).rows as { id: string }[];
  let free = false;
  for (const s of rows) {
    free = await listSlots(db, { shopId, serviceId: s.id, zoneId: null, now, days: 1, fromDay: today }).then((slots) => slots.length > 0, () => false);
    if (free) break;
  }
  if (freeTodayCache.size >= FREE_TODAY_KEPT) freeTodayCache.delete(freeTodayCache.keys().next().value!);
  freeTodayCache.set(key, free);
  return free;
}

/** The SELECT of one page, as the SQL that runs (exported so the plan script explains exactly it). */
export function exploreStatement(query: ExploreQuery, now: Date): { statement: SQL; fetched: number } {
  const { conditions, distance } = compileExplore(query, now);
  // « A free time today » is known only after the slot engine: read three pages' worth of candidates, keep the free ones.
  const fetched = query.open === "free-today" ? query.limit * 3 : query.limit;
  // The page is chosen first (filters, order, limit on the indexed read model); only its few shops get the per-row facts (open now, a window left today).
  const statement = sql`
    SELECT s.shop_id, s.slug, s.name, s.kind, s.area, s.tagline_fr, s.tagline_en, s.timezone, s.quartiers, s.lat, s.lng, s.distance_m,
           ${openNowSql(now)} AS open_now, ${windowAheadSql(now, 1)} AS window_left
    FROM (
      SELECT s.shop_id, s.slug, s.name, s.kind, s.area, s.tagline_fr, s.tagline_en, s.timezone, s.quartiers, s.lat, s.lng,
             ${distance ?? sql`NULL::float8`} AS distance_m
      FROM shop_search s
      WHERE ${and(...conditions)}
      ORDER BY ${distance ? sql`distance_m NULLS LAST,` : sql``} s.name, s.shop_id
      LIMIT ${fetched + 1} OFFSET ${query.offset}) s
    ORDER BY ${distance ? sql`s.distance_m NULLS LAST,` : sql``} s.name, s.shop_id`;
  return { statement, fetched };
}

export async function exploreSearch(db: Db, query: ExploreQuery, now: Date): Promise<ExplorePage> {
  const { statement, fetched } = exploreStatement(query, now);
  const rows = (await db.execute(statement)).rows as Row[];
  const candidates = rows.slice(0, fetched);
  const built = await inBatches(candidates, SLOT_CONCURRENCY, async (r): Promise<ExploreShopResult> => ({
    slug: r.slug,
    name: r.name,
    kind: r.kind,
    area: r.area,
    taglineFr: r.tagline_fr,
    taglineEn: r.tagline_en,
    quartiers: r.quartiers,
    point: r.lat !== null && r.lng !== null ? [r.lng, r.lat] : null,
    openNow: r.open_now,
    // No window left today = nothing to look up; otherwise the slot engine decides.
    freeToday: r.window_left && (await freeToday(db, r.shop_id, r.timezone, now)),
    distanceMeters: r.distance_m === null ? null : Math.round(r.distance_m),
  }));
  const shops = (query.open === "free-today" ? built.filter((s) => s.freeToday) : built).slice(0, query.limit);
  return { shops, next: rows.length > fetched ? query.offset + fetched : null };
}

/** Every published shop by name (the request without a filter): the page before the filters existed. */
export async function exploreShops(db: Db, now: Date): Promise<ExploreShopResult[]> {
  return (await exploreSearch(db, exploreQuerySchema.parse({}), now)).shops;
}

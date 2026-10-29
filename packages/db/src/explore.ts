import { type ExploreQuery, exploreQuerySchema, type ExploreShop, searchTokens } from "@akinaza/core";
import { and, type SQL, sql } from "drizzle-orm";

import type { Db } from "./client";
import { listSlots } from "./service-shop";

// @fixed: a shop's « next free time » is read from its first services only, each one query
const SERVICES_CHECKED = 3;
// @fixed: how many shops' free times the sweep computes at once (the slot engine is the one costly fact)
const SLOT_CONCURRENCY = 8;
// @fixed: how many local days ahead the stored « next free time » looks, and what « open this week » means
const AHEAD_DAYS = 7;
// @fixed: the most rows one sweep settles; the rest wait for the next tick
const SETTLE_BATCH = 200;
const EARTH_RADIUS_M = 6_371_000;
const KM_PER_DEGREE = 111.32;

/** What an Explorer page answers: the shops (with their distance from `near`, when given) and where the next page starts. */
export type ExploreShopResult = ExploreShop & {
  distanceMeters: number | null;
  /** The shop's next bookable time as the sweep stored it (« prochain créneau »); the shop page computes the live one. */
  nextFreeAt: string | null;
};
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

/** The shop has a weekly window on one of the next `days` local days (today whole), not a day off: « open this week » is by days, so it moves only at the day change. */
const windowAheadSql = (now: Date, days: number) => sql`EXISTS (
  SELECT 1 FROM generate_series(0, ${days - 1}) k
  CROSS JOIN LATERAL (SELECT ${localNow(now)}::date + k AS day) x
  JOIN staff st ON st.shop_id = s.shop_id AND st.active
  JOIN schedules sc ON sc.staff_id = st.id AND sc.weekday = EXTRACT(dow FROM x.day)::int
  WHERE NOT EXISTS (SELECT 1 FROM days_off d WHERE d.staff_id = st.id AND d.on_date = x.day))`;

/** The stored next free time is still ahead and falls on the shop's local today. */
const freeTodaySql = (now: Date) => sql`(s.next_free_at > ${now.toISOString()}::timestamptz AND (s.next_free_at AT TIME ZONE s.timezone)::date = ${localNow(now)}::date)`;

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
  // Both read what the sweep stored (`settleAvailability`): the slot engine never runs on the list path.
  if (query.open === "week") conditions.push(sql`s.open_week`);
  if (query.open === "free-today") conditions.push(freeTodaySql(now));
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
  timezone: string; quartiers: string[]; lat: number | null; lng: number | null; open_now: boolean; free_today: boolean; next_free_at: string | null; distance_m: number | null;
}

/** Runs `work` over `items`, at most `size` at a time. */
async function inBatches<T>(items: readonly T[], size: number, work: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(work));
}

/** The first time a client could book at the shop within the next days (the earliest of its first services), null = none. */
async function nextFreeTime(db: Db, shopId: string, now: Date): Promise<Date | null> {
  const rows = (await db.execute(sql`SELECT id FROM services WHERE shop_id = ${shopId} AND active ORDER BY duration_minutes, name_en LIMIT ${SERVICES_CHECKED}`)).rows as { id: string }[];
  let first: Date | null = null;
  for (const service of rows) {
    const slots = await listSlots(db, { shopId, serviceId: service.id, zoneId: null, now, days: AHEAD_DAYS }).catch(() => []);
    const at = slots[0]?.startsAt;
    if (at && (!first || at < first)) first = at;
  }
  return first;
}

/**
 * The sweep (ADR-006 decision 4, CTO decision on akinaza#574): recomputes the stored availability of the rows that are due, at the
 * injected clock. A row is due when something it depends on changed (a trigger raised `avail_stale`: booking, hours, day off, rule,
 * service, calendar), when its shop's local day moved on, or when the stored time has passed. The flag is lowered before the
 * computing, so a change made meanwhile raises it again and the next sweep redoes the shop. Rows are leased (`SKIP LOCKED`), so
 * several instances never do the same shop. Returns how many shops were settled.
 */
export async function settleAvailability(db: Db, now: Date, batch: number = SETTLE_BATCH): Promise<number> {
  const at = now.toISOString();
  const claimed = (await db.execute(sql`
    UPDATE shop_search u SET avail_stale = false
     WHERE u.shop_id IN (
       SELECT q.shop_id FROM shop_search q
        WHERE q.avail_stale OR q.avail_day IS DISTINCT FROM (${at}::timestamptz AT TIME ZONE q.timezone)::date
           OR q.avail_at > ${at}::timestamptz OR (q.next_free_at IS NOT NULL AND q.next_free_at <= ${at}::timestamptz)
        ORDER BY q.avail_stale DESC, q.shop_id
        LIMIT ${batch} FOR UPDATE SKIP LOCKED)
    RETURNING u.shop_id`)).rows as { shop_id: string }[];
  await inBatches(claimed, SLOT_CONCURRENCY, async ({ shop_id: shopId }) => {
    const free = await nextFreeTime(db, shopId, now);
    await db.execute(sql`
      UPDATE shop_search s SET next_free_at = ${free ? free.toISOString() : null}::timestamptz,
             open_week = ${windowAheadSql(now, AHEAD_DAYS)}, avail_day = ${localNow(now)}::date, avail_at = ${at}::timestamptz
       WHERE s.shop_id = ${shopId}`);
  });
  return claimed.length;
}

/** The SELECT of one page, as the SQL that runs (exported so the plan script explains exactly it). */
export function exploreStatement(query: ExploreQuery, now: Date): { statement: SQL; fetched: number } {
  const { conditions, distance } = compileExplore(query, now);
  const fetched = query.limit;
  // The page is chosen first (filters, order, limit on the indexed read model); only its few shops get the per-row fact (open now).
  const statement = sql`
    SELECT s.shop_id, s.slug, s.name, s.kind, s.area, s.tagline_fr, s.tagline_en, s.timezone, s.quartiers, s.lat, s.lng, s.distance_m, s.next_free_at, ${freeTodaySql(now)} AS free_today,
           ${openNowSql(now)} AS open_now
    FROM (
      SELECT s.shop_id, s.slug, s.name, s.kind, s.area, s.tagline_fr, s.tagline_en, s.timezone, s.quartiers, s.lat, s.lng, s.next_free_at,
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
  const shops = rows.slice(0, fetched).map((r): ExploreShopResult => ({
    slug: r.slug,
    name: r.name,
    kind: r.kind,
    area: r.area,
    taglineFr: r.tagline_fr,
    taglineEn: r.tagline_en,
    quartiers: r.quartiers,
    point: r.lat !== null && r.lng !== null ? [r.lng, r.lat] : null,
    openNow: r.open_now,
    freeToday: r.free_today,
    nextFreeAt: r.next_free_at === null ? null : new Date(r.next_free_at).toISOString(),
    distanceMeters: r.distance_m === null ? null : Math.round(r.distance_m),
  }));
  return { shops, next: rows.length > fetched ? query.offset + fetched : null };
}

/** Every published shop by name (the request without a filter): the page before the filters existed. */
export async function exploreShops(db: Db, now: Date): Promise<ExploreShopResult[]> {
  return (await exploreSearch(db, exploreQuerySchema.parse({}), now)).shops;
}

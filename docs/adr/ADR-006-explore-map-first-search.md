# ADR-006 — Explorer: map first, combined filters, dynamic search on trusted libraries

Status: **proposed** (2026-10-29). Issue: krizaka/akinaza#571 (Feature). Slice 1 of 5; slices 2 to 5 are listed at the end.
Founder request (2026-10-29): « Inspire-toi de Google Maps : un bloc d'info sur la carte, l'utilisateur choisit d'aller à la
boutique. Filtre plus riche, recherches combinées, recherche dynamique et optimisée, pas de roue réinventée. »

## Context (main, 2026-10-29)

| Piece | Today | Where |
| --- | --- | --- |
| Data | `GET /api/explore/shops` returns **all** published shops (at most 200) with `openNow` and `freeToday`, no parameter. Per shop: `publicShop` plus up to 3 `listSlots` queries, so about 1 + 4N queries per request | `apps/web/app/api/explore/shops/route.ts`, `packages/db/src/explore.ts` |
| Filtering | in the browser: `filterShops`, `rankByDistance`; single-choice chips (All, Services, Open now, A free time today) and a count | `packages/core/src/explore.ts`, `components/explore/ExploreView.tsx` |
| Location | a shop has **areas served** (`shop_zones`, a name and a centre lat/lng); no street address is ever exposed (privacy rule of #235) | `shopZones` in `packages/db/src/schema.ts` |
| Map | MapLibre through `@krizaka/ui/map` (Protomaps basemap served from our own origin) | `components/explore/ExploreMap.tsx` |
| State | component state; a shop link leaves the page and the place is lost | `ExploreView.tsx` |
| Search index | none (no `tsvector`, no `pg_trgm`, no `earthdistance` in the 45 migrations) | `packages/db/drizzle` |

Problems: (1) the journey map → shop → back loses the map position; (2) filters are exclusive and poor; (3) the whole list is
rebuilt per request, so cost grows with the number of shops (not acceptable beyond a few hundred); (4) there is no text
search at all.

## Decision 1 — The experience

- **The map is the page.** A pin opens an **info card on the map**: a bottom sheet on a phone, a side card on a desktop. It
  holds the photo, name, kind, « open now · closes at 5 pm », the next free time, the distance, and **one action**,
  « View the shop » (« Réserver » when a time is free). Closing the card keeps the map where it was: no navigation until the
  action is taken. The shop opens in the same tab; the back button returns to the same card and viewport (Decision 2).
- The **list and the map are one state**: hovering or focusing a row highlights its pin; selecting a pin scrolls to its row;
  moving the map shows « Search this area » (it never refetches by itself while the user is panning).
- **Filters combine** (AND between groups, OR inside a group): text; service type (multi-select from the shop catalogue);
  opening (`now` | `week` | `free-today`); distance (1, 3, 10, 25 km from the user or from a typed place); price band.
  Active filters are removable chips, plus « Clear all ». The count and the empty state say what to relax.
- Phone and desktop, both themes, EN/FR, keyboard (the card is a dialog with focus return; pins are buttons), CLS 0 (fixed
  card and sheet boxes, results keep the previous list on screen while loading).

## Decision 2 — State in the URL: `nuqs` behind a `@krizaka/*` facade

Every filter and the viewport (`?q=&kind=hair,nails&open=week&within=3&bbox=…&shop=<slug>`) is in the URL: shareable,
back/forward restore the search, the selected pin (`shop`) survives a reload.

- **Choice:** [`nuqs`](https://nuqs.dev) (MIT, type-safe search params for the Next.js App Router, maintained, widely adopted,
  built-in throttling/debounce and `history: "replace"` vs `"push"`). Nothing in `@krizaka/*` offers URL state today
  (`@krizaka/query` 0.2.2 exports core, react, server, persist, native, devtools only).
- **Rule « libs first »:** the app does not import `nuqs` directly. Slice 3 begins by adding a `@krizaka/query/url`
  facade (a `useQueryState`-style hook taking a zod schema, plus the server-side parser) in `krizaka-ui`/`krizaka-query`,
  released, then used here. The filter schema (Decision 3) is the single source for the parser, the endpoint and the cache key.
- Rejected: hand-written `URLSearchParams` plus `router.replace` (what nuqs already does, with the races solved); a state
  library (Zustand) for the filters (not shareable).

## Decision 3 — One typed filter schema, compiled to Drizzle conditions (no hand-built SQL)

A single zod schema, `ExploreQuery`, in `@akinaza/core` (pure, no db):

```
q?: string (2..60)      kinds?: KindId[]        services?: ServiceKind[]
open?: "now" | "week" | "free-today"
near?: [lng, lat]       within?: 1|3|10|25 (km)  bbox?: [w, s, e, n]
price?: "$"|"$$"|"$$$"  limit (default 30, max 60)  cursor?: opaque keyset token
```

`compileExplore(query, now)` in `@akinaza/db` returns an array of Drizzle `SQL` conditions combined with
`and(...conditions)`; each condition is a parameterised fragment (`inArray`, `eq`, `sql` template with bound values).
There is no string concatenation of SQL and no user text inside a `sql.raw`. Drizzle's composable `where` is the "library to
build the dynamic query": no extra query-builder dependency (Kysely, Prisma) is introduced; the ORM already in use is the
trusted choice. The same schema parses the URL (Decision 2), the request (`GET /api/explore/shops`, validated, unknown keys
refused) and builds the TanStack Query key (Decision 5).

## Decision 4 — Postgres does the search; no search engine now

Order of the index work, each checked with `EXPLAIN (ANALYZE, BUFFERS)` on the seeded cast and on a 20 000-shop synthetic set:

| Need | Choice | Index |
| --- | --- | --- |
| Text (name, tagline, area, service names) | **FTS**: a generated `search` `tsvector` (`french`/`english` config by locale, `unaccent`) on a small read model `shop_search(shop_id, search, name, kind, point, price_band, …)` | GIN on `search` |
| Typos and partial names (« coif ») | **`pg_trgm`** `similarity` / `ILIKE` on `name` and service names, as the fallback when FTS returns nothing and for prefix matches | GIN `gin_trgm_ops` on `name` |
| Distance and viewport | **`cube` + `earthdistance`**: `ll_to_earth(lat, lng)`, `earth_box` for the bounding filter, `earth_distance` for the order | GiST on `ll_to_earth(lat, lng)` of the zone centres |
| Service type, kind, price band | plain `btree` / `inArray` on the read model | btree on `(kind)`, `(price_band)`; GIN on the `services text[]` |
| Open now / this week / free today | computed **with the injected clock** (`requestNow()`), never `now()` in SQL: `open_windows` of the shop joined on `weekday` in the shop's own timezone (`AT TIME ZONE shops.timezone`), minus `days_off`; « this week » = at least one window in the next 7 local days; « free today » = the existing slot engine, only for the page's candidates (see below) | btree `(shop_id, weekday)` already exists |

- **Why `earthdistance` and not PostGIS first:** the points are the *centres of the areas served* (no street address, by the
  privacy rule), so metre precision is meaningless; `cube`/`earthdistance` are contrib extensions available on managed
  Postgres with no extra component. PostGIS stays the upgrade if polygons (real service areas) arrive; the compile function hides
  the choice. **To verify in slice 2:** `CREATE EXTENSION` of `pg_trgm`, `unaccent`, `cube`, `earthdistance` on the dev and prod
  clusters (migration + a test that fails clearly if one is missing).
- **The read model** (`shop_search`) is refreshed by the writers that already change a published shop (publish, page save,
  services and hours saves), in the same transaction; a nightly check compares it with `publicShop` (a guard, not a source).
  It removes the 1 + 4N queries: the list is one indexed query.
- **« Free time today »** is the one expensive fact (the slot engine). It is not part of the list query: the endpoint first
  selects the page's candidate ids (limit 30), then computes `freeToday` for those only (bounded concurrency, cached 60 s per
  shop and day). The filter `open=free-today` therefore runs the candidate query over-fetching (limit × 3) and keeps the
  free ones; documented limit, measured in slice 2.
- **Latency target:** p95 < 200 ms server-side for the combined query on the dev dataset and on 20 000 shops (excluding the free-today
  step: p95 < 400 ms with it); the PR of slice 2 carries the `EXPLAIN` plans and a timing script.
- **Later, only if Postgres is not enough** (facets over 100 000 shops, typo tolerance beyond trigrams): Meilisearch or
  Typesense behind a port; not now (cost, operations, a second source of truth).

## Decision 5 — Fetching: `@krizaka/query`

- A `useExploreShops(query)` hook on `@krizaka/query` (TanStack Query behind the facade): key = the parsed `ExploreQuery`
  (stable-serialised); `placeholderData: keepPreviousData` so the list never blanks; `AbortSignal` passed to `fetch` so a
  superseded request is cancelled; `staleTime` 30 s; text input debounced 200 ms (nuqs `debounceMs` for `q` only; chips and
  the map move apply at once; the viewport is applied on « Search this area »).
- The first page is rendered by the server component from the URL (same `compileExplore`, no client waterfall), then
  hydrated into the query cache. No `fetch` in a `useEffect` (stack rule).
- HTTP: `Cache-Control: public, s-maxage=30, stale-while-revalidate=120` only for queries without `near` (no personal
  position in a shared cache); with `near` it is `private, max-age=30`.

## Decision 6 — Map and pieces

- **Map:** keep MapLibre through `@krizaka/ui/map`. Pins are a GeoJSON source with clustering (MapLibre does it natively), the
  selected pin is a feature-state, not a re-render of the whole layer.
- **Krizaka UI:** `FilterBar`, `Chip`, `SearchField` exist (3.70+). A **`BottomSheet`** is not in the installed catalogue (3.70.0): check the
  3.75 catalogue; if absent it is added to `krizaka-ui` first (snap points, drag handle, focus trap, reduced motion, tests),
  released, then used. Desktop side card = `Card` in a fixed column. Any other missing piece goes to krizaka-ui, never copied here.
- **Privacy** is unchanged: the card shows what the public page already says (no street address, no owner, no counts).

## Consequences

- One indexed query replaces 1 + 4N; the page scales with results shown, not with shops registered.
- Two new org-visible pieces: a `url` facade (Decision 2) and a possible `BottomSheet`; both are krizaka-ui work in front of slices 3 and 4.
- A read model to keep in step (guarded by the nightly comparison and a test per writer).
- Extensions to enable on the clusters (a migration; infra check in slice 2).

## Slices

1. This ADR.
2. Backend: `ExploreQuery` schema in core, `compileExplore`, the `shop_search` read model and its indexes (migration),
   `GET /api/explore/shops` rebuilt on it; tests on the seeded cast (each filter alone and combined, clock injected, a shop in
   another timezone, a day off); `EXPLAIN` plans and timings in the PR.
3. Front: `@krizaka/query/url` facade, URL state, filter bar with combinable chips and « Clear all ».
4. Front: info card (bottom sheet / side card), list-map sync, « Search this area », focus and history behaviour.
5. e2e journey (persona): find a shop open this week for a service → card → book; phone and desktop, both themes; video from the journey.

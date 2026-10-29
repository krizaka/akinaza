# ADR-006 — Explorer: map first, combined filters, dynamic search on trusted libraries

Status: **proposed** (2026-10-29, revised the same day with the founder's two additions on #571: one map style and the shop
route view, then configurability). Issue: krizaka/akinaza#571 (Feature). Slice 1 of the list at the end.
Founder request (2026-10-29): « Inspire-toi de Google Maps : un bloc d'info sur la carte, l'utilisateur choisit d'aller à la
boutique. Filtre plus riche, recherches combinées, recherche dynamique et optimisée, pas de roue réinventée. »

## Context (main, 2026-10-29)

| Piece | Today | Where |
| --- | --- | --- |
| Data | `GET /api/explore/shops` returns **all** published shops (at most 200) with `openNow` and `freeToday`, no parameter. Per shop: `publicShop` plus up to 3 `listSlots` queries, so about 1 + 4N queries per request | `apps/web/app/api/explore/shops/route.ts`, `packages/db/src/explore.ts` |
| Filtering | in the browser: `filterShops`, `rankByDistance`; single-choice chips (All, Services, Open now, A free time today) and a count | `packages/core/src/explore.ts`, `components/explore/ExploreView.tsx` |
| Location | a shop has **areas served** (`shop_zones`, a name and a centre lat/lng); no street address is ever exposed (privacy rule of #235) | `shopZones` in `packages/db/src/schema.ts` |
| Map | MapLibre through `@krizaka/ui/map` (Protomaps basemap served from our own origin); the explore page draws `Map`, `Marker`, `UserPosition` | `components/explore/ExploreMap.tsx` |
| Shop page « route view » | the `zones` section is krizaka-ui's `VisitSection` with a `map` of the areas served (the hours card when there are none); no way to get there, no times, no hand-off | `components/shop/ShopPageView.tsx` (`s_zones`) |
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
  the choice. **Verified (2026-10-29, read-only
  `pg_available_extensions` on the dev cluster, PostgreSQL 18.6 managed):** `pg_trgm` 1.6, `unaccent` 1.1, `cube` 1.5,
  `earthdistance` 1.2, `btree_gin` 1.3, `btree_gist` 1.8 (installed) and even `postgis` 3.6.4 are all **available**, none
  except `btree_gist` is installed yet: slice 2's migration runs `CREATE EXTENSION IF NOT EXISTS` for the four, with a test
  that fails clearly when one is missing (CI uses the PostgreSQL service of the org workflow, the contrib set is in the
  image). Only the dev cluster is configured today (one `AKINAZA_DATABASE_URL`, six shops): the same migration applies to
  production at its first deploy, and the managed service lists the same extensions.
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
- **Krizaka UI:** `FilterBar`, `Chip`, `SearchField` exist (3.70+). **Checked on krizaka-ui main (3.75):** there is
  **no `BottomSheet`**. `Dialog`/`Sheet` (`placement="bottom"`) is a **modal** sheet (scrim, focus trap, the page behind is
  inert), which is wrong for a card that sits over a map the user keeps panning. A non-modal **`BottomSheet`** is added to
  `krizaka-ui` first (snap points peek / half / full, drag handle with keyboard equivalents, no scrim, the map stays live,
  focus moves to the card when it opens and returns to the pin on close, reduced motion, stories, tests), released, then
  used. Desktop side card = `Card` in a fixed column. Any other missing piece goes to krizaka-ui, never copied here.
- **Privacy** is unchanged: the card shows what the public page already says (no street address, no owner, no counts).

## Decision 7 — One map style for every Akinaza map (founder addition)

**What exists (krizaka-ui 3.75, `@krizaka/ui/map`):** a style generated from the tokens, not a stock one: `mapPalette(scheme, brand)`
(land, background, water, park, road, casing, building, boundary, labels from `@krizaka/tokens`), `mapFlavor` and `mapStyle`
over the Protomaps basemap layers, dark and light, tiles as PMTiles on our CDN (`MAP_TILES`, `setMapAssetsBase`), plus `Map`,
`Marker`, `Cluster`, `UserPosition`, `RadiusCircle`, `Route` (animated path), `StaticMap` (the fallback), `LocationPicker`, and the
geometry helpers. So the style generator is **not rebuilt**: it is extended.

**What is missing, to build in krizaka-ui (stories, tests, ui.krizaka.com docs, released, then used):**

| Piece | What it adds | Notes |
| --- | --- | --- |
| `mapStyle` variants | `variant: "plain" \| "notebook" \| "muted"` and `scheme: "light" \| "dark" \| "auto"` (follows the theme). **Notebook** = the Cahier spirit on public pages: warm paper land, ink-blue linework, softened roads, hand-set label weight, drawn from the Cahier tokens (krizaka-ui 3.63, B60), never a hex typed in Akinaza | one generator, so explore, shop page, booking and the console cannot drift |
| `MapPin` | pin shapes (drop, disc, label chip) and states (rest, hover, selected, closed) in token colours; accessible name; `aria-pressed` when selected; replaces ad-hoc `Marker` children | clusters use the same palette |
| `MapCluster` style | count bubble, radius and `maxZoom` options (clustering stays MapLibre-native) | `Cluster` exists: add the look and options |
| `MapInfoCard` | the card of Decision 1: photo slot, title, meta line, status, one primary action; same content in the `BottomSheet` (phone) and the side column (desktop); keyboard and screen reader (dialog semantics without a trap) | content comes by props: fields shown are configurable (Decision 9) |
| `BottomSheet` | non-modal, snap points, see Decision 6 | also usable by the console |
| `RouteCard` | destination, « Itinéraire » menu of providers, the times row (walk, bike, drive, transit), reduced-motion-safe map | Decision 8 |

**Rule:** after the pieces are released, **every** Akinaza map uses them and nothing else: explore (`ExploreMap`), the shop page
(`VisitSection` map), the booking confirmation, the owner console (`MapSetup`, location picker). A guard follows the rule: an
ast-grep rule refuses an import of `maplibre-gl` or `@krizaka/ui/map`'s raw `mapStyle` in `apps/web` outside the one wrapper
(`components/maps/`), and a `check-maps` extension (the script exists) loads one page per map surface in both themes.

## Decision 8 — The shop page route view, redesigned (founder addition)

**Today (captured on the seeded Saint-Henri shop, both themes, desktop and phone; CDN `pr-assets/akinaza/adr-006-route-before/visit-*.png`):**
the « Areas served » section is a large box with only the zoom buttons. On the phone it is the `StaticMap` fallback: a grid, three
dots, no street, no area names, no scale. On desktop the basemap did not draw in the headless run (empty box, attribution only):
whether that is the run (no WebGL or tiles) or a fault is not established, and the slice adds a check-maps case for it. There is
no itinerary, no distance and no time, and nothing leads from the map to the shop's door. The founder calls it « horrible ».

**Target (phone first):**

- An **interactive map**, not a picture: pan and zoom by gesture, `cooperativeGestures` on the page (two fingers to move the map
  inside a scrolling page, one finger to scroll the page), keyboard (arrows, +/-), a visible « Reset view » control, reduced
  motion respected (no fly-to, the path appears at once). A fixed aspect box: CLS 0. The static fallback (`StaticMap`) is drawn
  without JavaScript and when WebGL is unavailable.
- **The destination is what the shop agreed to show.** The street address is private (rule of #235, `shops.address` never
  leaves the server). The route card therefore points at the **area** (name and centre of the nearest zone) by default, labelled
  « Area served ». The owner can turn on **« Show my address for directions »** (owner setting, off by default) to hand off the
  street address, and a **confirmed booking** shows the real address to the client who booked (the confirmation already has a
  `where` row). Without either, the card says so rather than inventing a precise place.
- **« Itinéraire » hands off to the user's map app.** A menu of deep links built in a pure, tested function
  (`routeLinks(destination, origin?)` in krizaka-ui, so every product reuses it): Apple Maps (`https://maps.apple.com/?daddr=`,
  first on iOS/macOS), Google Maps (`https://www.google.com/maps/dir/?api=1&destination=&travelmode=`), OpenStreetMap
  (`https://www.openstreetmap.org/directions?to=`), Waze (`https://waze.com/ul?ll=…&navigate=yes`) and a transit link (Google
  `travelmode=transit`; Transit app / STM as an option in the admin list). The links open in a new tab with
  `rel="noopener"`; no tracking parameter, no SDK.
- **Times: honest by construction.** Walking, cycling and driving times are **estimates from the straight-line distance**
  (speeds in settings, labelled « about 12 min on foot »), shown only when the user has shared a position (asked on a tap on
  « Near me », never on load). **Transit has no estimate**: it is a hand-off, and the card says « Open in your transit app ».
  Real routed times need a routing engine; the trusted open-source options are **Valhalla** and **OSRM** (both permissive,
  widely deployed, self-hostable, fed by the OpenStreetMap extract of Quebec we already tile). They are **not** adopted now: an
  extra service to run, for a number the provider apps give better at hand-off. The `RouteCard` takes a `times` prop, so a
  routing port can fill it later with no UI change (recorded as the upgrade path, like Meilisearch in Decision 4).
- Content (EN/FR): all words from the catalogues; the card is a landmark with a heading; every control reachable by keyboard
  and named for a screen reader; the map has a text alternative (area names, distance).

**Captures.** *Before* (taken on a seeded local shop, the Saint-Henri persona, `visit` scene of `scripts/shots-storefront.mjs`,
desktop and phone, light and dark): the four files above, linked from the PR. *After*: taken by the slice that ships the route view,
with the same scene, and added to that PR.

## Decision 9 — Configurable at three levels, a good default at each (founder addition)

Rule « admin configures everything »: every option has a typed schema, a **default**, an owner and an audit trail where it
is changed, so a map with zero configuration is good.

| Level | Who | Where it lives | What |
| --- | --- | --- | --- |
| **Library** | the developer | krizaka-ui props, documented with examples on ui.krizaka.com | style variant (notebook, plain, muted), scheme (light, dark, auto), pin shape and colour tokens, clustering on/off and radius, info card fields and layout, controls shown (zoom, locate me, fullscreen, compass, reset), gestures, initial viewport (bounds or centre and zoom), list-map sync on/off, route providers offered (Apple, Google, OSM, Waze, transit) |
| **Admin** | Akinaza operators | the database through the existing admin settings store (`appSettings()`, `GET/PUT /api/admin/settings/[key]`, answers `{ value, source }`, with its audit history, as for the protected terms), read by the app and workers | default style variant and zoom; which filters appear and in which order; the service-type list; the radius options (`1, 3, 10, 25`); whether « open this week » and « a time today » show; the route providers shown and their order; the walking, cycling and driving speeds of the estimates |
| **Owner** | one shop | the shop page settings in the console (same document as the other sections, versioned) | the pin label; the photo on the info card (among the shop's photos); which opening hours the card shows; whether the route card shows walking, cycling, driving and transit; « Show my address for directions » (off by default) |

- **Precedence:** owner > admin > library default, each narrowing only what the level above allows (an owner cannot enable a
  provider the admin removed). A single pure `resolveMapConfig(library, admin, owner)` in `@akinaza/core`, one schema (zod),
  tested for precedence, and the single place the pages read.
- **Where each setting is seeded:** the admin keys are declared in the settings registry with their default (no value in a
  component), the owner keys in the shop page document schema with their default and a migration if needed.
- **Audit:** admin changes go through the existing audited settings path (who, when, old and new value); owner changes are
  versioned with the page.

## krizaka-ui pieces to build (in front of the Akinaza slices that use them)

1. `BottomSheet` (non-modal, snap points) — before slice 4 and before the route view.
2. Map style variants (`notebook`, `plain`, `muted`; `auto` scheme) — before the route view.
3. `MapPin` and the `MapCluster` look — before slice 4.
4. `MapInfoCard` (with the `BottomSheet` and side-card layouts) — slice 4.
5. `RouteCard` and `routeLinks` — the route view.
6. A `@krizaka/query/url` facade (Decision 2) — slice 3.

Each: meta, stories, tests, docs on ui.krizaka.com, released; then the Akinaza slice consumes it.

## Consequences

- One indexed query replaces 1 + 4N; the page scales with results shown, not with shops registered.
- Six krizaka-ui pieces (list above) in front of the Akinaza slices that use them; one map style and one config resolver for the whole product.
- An honest route view: the street address stays private unless the owner turns it on; the times are estimates and say so.
- A read model to keep in step (guarded by the nightly comparison and a test per writer).
- Four extensions to enable by migration (verified available on the dev cluster).

## Slices (sub-issues of akinaza#571, in this order)

1. This ADR (docs).
2. Backend: `ExploreQuery` schema in core, `compileExplore`, the `shop_search` read model and its indexes (migration with the
   four extensions), `GET /api/explore/shops` rebuilt on it; tests on the seeded cast (each filter alone and combined, clock
   injected, a shop in another timezone, a day off); `EXPLAIN` plans and p95 timings in the PR.
3. krizaka-ui: `BottomSheet`, map style variants, `MapPin` + cluster look (stories, tests, released).
4. krizaka-ui: `MapInfoCard`, `RouteCard` + `routeLinks`, and the `@krizaka/query/url` facade (released).
5. Front: URL state and filter bar (combinable chips, « Clear all »), on the new endpoint.
6. Front: explore map-first (info card, list-map sync, « Search this area », focus and history behaviour).
7. Front: the shop page route view, on the pieces, with the before/after captures; every map moved to the one wrapper and its guard.
8. Settings: `resolveMapConfig`, admin settings (DB, audited) and owner settings (shop page), with defaults.
9. e2e journey (persona): find a shop open this week for a service, open the card, book; and the route hand-off; phone and
   desktop, both themes; video from the journey.

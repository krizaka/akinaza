# ADR-004 — The customisable shop: the page as a document, Krizaka UI variants, look presets, the owner's composer

Status: accepted (2026-10-27). Issue: krizaka/akinaza#398. Product half of krizaka-ui
[ADR-007](https://github.com/krizaka/krizaka-ui/blob/main/docs/adr/ADR-007-shop-composer.md) (the library half: schema,
13 section types, presets, `@krizaka/ui/shop-composer`, krizaka-ui#742–#746). Prices stay data (ADR-009, krizaka/.github#253).

## Context

- The founder (2026-10-26, on the demo salon): the shop page does not make you want to book. The service photos are too big
  and one photo comes back twice. The spacing is loose, and the page is not aligned with the rest of the shop. He asks for
  two things. **The owner customises the shop**: which sections, in what order, and which variant of each. **The two demo
  shops are the showcase of Krizaka UI.**
- The founder's rules: the public shop pages are an **artistic notebook** (Cahier). The owner customises the shop, and the
  administrator configures everything. **Settings live in the database.** **Libraries come first**: a missing piece goes
  into `@krizaka/ui` first.
- Already on `main` (B71, #424–#428). The page is a document in `shop_page_versions`: one draft, the published versions and
  the last 20 archived, every write audited. Migration 0038 turned every existing page into a published v1
  (`documentFromLegacy`). The public page renders through `@krizaka/ui/shop` with `planPhotos`, so each photo appears
  once and the cover is preloaded. Boutique › Page › Layout mounts `ShopComposerPanel`. The demo shops have a « See it
  another way » switch.
- Two older plans wait on this ADR. **B45** (#236, #311–#315, #317) puts the shop « as a place »: the wall, the TV, the
  reviews, the bulletin board, the booking on paper. **B54** (#261, #304, #305, #316) adds a second template schema, the
  `@1` / `@2` templates, with `shop_page.paper` and the `cahier` block. Both predate the document. Built as written, they
  would give the page two models.

## Decision

**One model: the shop page is the `@krizaka/ui/shop` document stored in Akinaza's database. Every section and variant
comes from `@krizaka/ui`. The Cahier is a look preset, not a second schema. A template is a starter document plus a
preset, and its version is the preset's `version`. The owner edits in the composer, and the administrator bounds it
through settings.**

### Options weighed

- ✓ **The document of ADR-007, with B45/B54 folded into it as sections, variants and preset versions**
  → one renderer, one validator and one migration path, and every look the owner picks has been tested AA.
  ! B54's design is re-cut into slices, and its separate template schema is never built.
- ✕ **B54 as specified (a template `@2` schema beside the document, `shop_page.paper`, a `cahier` block)**
  → two sources of truth for the same page, and every template change becomes a data migration.
- ✕ **Puck, Craft.js or GrapesJS behind a facade** → ADR-007 §5: the model is a list, not a canvas. Puck brings
  36 dependencies and a skin we would have to restyle.
  ! The trigger to revisit is nested free composition, then behind `@krizaka/ui/composer`.
- ✕ **Code or CSS per shop** → no page stays beautiful, contrast cannot be proven, and nothing is auditable.

### 1. The data model

| Piece | Where | Shape |
| :-- | :-- | :-- |
| Page document | `shop_page_versions.doc` (jsonb), `status` draft · published · archived, `based_on`, `created_by`; `shop_page.published_version_id` | `ShopPage` of `@krizaka/ui/shop`: `{ schema, preset: { id, version }, density?, sections[] }`, at most 16 sections, the hero first, at most 24 blocks per section |
| Section | in the document | `{ key, type, variant, disabled?, settings, text?: { title, lead } as { fr, en }, blocks? }`; settings are **references** (service ids, media ids, a reviews rule), never a price or a copy |
| Variant | `@krizaka/ui/shop` catalogue | checked by `parseShopPage` on write (422 with the path) and on read |
| Look preset | `@krizaka/tokens/shop-presets` (12, two per trade) | `{ id, version, paper, accent, faces, density, photo, variants }`. The owner picks a preset and one accent from the preset's tested list (`shop_page.accent`) |
| Template | starters in `@krizaka/ui/shop` + `TRADE_PRESETS` | a template is a starter document plus a preset. A new salon starts on `salonCompact` and `salon-vitrine` |
| Limits | `@krizaka/settings` (`apps/web/lib/settings.ts`), set by the administrator | `limits.reelSeconds`, `limits.reelMegabytes`, `wallItems`, plus, to add: the presets and section types offered per trade, and the demo switch on or off |

- ✓ **`@2` is the preset's `version`.** The Cahier (paper, stamps, hand-drawn dividers, faces) ships as version 2 of each
  preset in `@krizaka/tokens`. The document stores `{ id, version }`, so a published page never changes under its owner.
  → The look is versioned where it is defined, and the content is untouched by construction.
- ✓ **« Update available »**: the composer compares the document's preset version with the latest in `@krizaka/tokens`
  and offers « Try the new look » **on the draft only**. Publishing goes through the usual diff.
  ! A preset version may never be deleted while a published version uses it. The library's test keeps every version
  that has shipped.
- ✓ **A new starter never rewrites an owner's sections.** « Start from a composition » creates a draft from the starter
  and the shop's own data, and the owner publishes it after the diff.
- ✓ **Migration of existing shops**: already done once (0038, published v1, same order, today's variants). A newer
  document schema migrates in memory (`migrateShopPage`) and is written back on the next save. **The retirement** of
  `template_id`, `template_version`, `sections_custom`, `style`, the `/api/walker/shop-page/template` route and
  `lib/template-choices.ts` comes one release after slice S1 is green: a migration drops them, and a test proves that no
  read is left.
  ! Until then, the legacy columns are read by nothing on the public path.

### 2. `@krizaka/ui` versus Akinaza

| `@krizaka/ui` / `@krizaka/tokens` (first) | Akinaza |
| :-- | :-- |
| `shopPageSchema`, `defineSection`, `migrateShopPage`, the 13 section types and their variants, the starters, `ShopFrame` | storage, routes, audit, roles, tenancy |
| the look presets and their contrast matrix; the Cahier's paper, stamps and dividers as preset v2 | `TRADE_PRESETS`, `DEMO_LOOKS`, the accent column |
| `@krizaka/ui/shop-composer` (outline, inspector, history, preview bridge) and `WallEditor`, `RetroTv`, `PinnedNote` | `ShopComposerPanel` (data, autosave, publish), the draft preview route |
| `EmbedFacade`, `map-gate` | the resolvers (services and prices from the catalogue, media through `planPhotos`, reviews through their rule) |

- ✕ **A section, variant or editor widget written in Akinaza** → it goes into krizaka-ui (meta, stories, tests), is
  released, and is then used here.

### 3. The editor (Boutique › Page)

- ✓ **Three panes on desktop**: the outline, the live preview, the inspector. The preview is an `iframe` of the public
  route with `?draft=`, checked by session, with a phone/desktop toggle and an origin-checked `postMessage` bridge.
- ✓ **Two steps on a phone**: the list, then the section. The preview is one tap away. Every target is at least 44 px.
- ✓ **Undo and redo**: 100 steps, ⌘Z / ⇧⌘Z. Autosave is debounced at 800 ms, and « Saved » is said in a live region.
  « Publish » shows the diff first. « Discard the draft » asks before it acts. Rollback restores one of the last 20
  versions.
- ✓ **The keyboard reorders**: Alt+↑/↓ or the row's menu, with every move announced and focus kept on the moved row.
  Drag is an extra.
- ✓ **Content editors live in the inspector**, not on separate pages: the wall (`WallEditor`), the bulletin board's
  flyers, the reviews rule, the reel and its links. Each one is bounded server-side by the settings.
- ✓ **Roles**: owner and manager edit and publish. Staff read. The preset and the identity belong to the owner.

### 4. Performance budgets (the open boxes of #401 and #404)

Measured in CI on both demo shops, phone 390 × 844, by a script run in `ci-after-build.sh`:

| Budget | Value | Failure |
| :-- | :-- | :-- |
| LCP element | the hero's image, or its `h1` when there is none; nothing above it, no reveal on it | the build fails |
| LCP | ≤ 2.5 s (lab, mobile throttling) | the build fails |
| CLS | 0 expected, ≤ 0.02 hard limit: fixed ratio boxes, fonts preloaded by `next/font/local` | the build fails |
| Client JS of the public page | ≤ the baseline in a lock file (a ratchet that only goes down); the composer chunk never in it | the build fails |
| Length | the compact salon fits in ≤ 5 phone screens | the build fails |
| Media | no `src` twice in any demo or starter document (`shop-page-media.test.ts`) | the test fails |
| Third parties | no request before a click; the CSP of #390 unchanged | the existing test |

### 5. Accessibility

- ✓ WCAG 2.2 AA in both themes. It is proven once per preset × mode in `@krizaka/tokens`, and axe runs on the public page
  in the page audit (#452).
- ✓ One `h1`. Every section is a `section` with its `h2`. Prices are text. The tab order is the visual order. Reduced
  motion stills the wall, the TV and the loops. Every stamp has a text equivalent.
- ✓ In the composer: the variant picker is a radio group, the preview `iframe` has a title, and errors are shown next to
  the field and summarised on publish.

### 6. What is refused

- ✕ A free colour, free CSS or HTML, nested blocks, a section above the hero, or code per shop
  → AA and the frame cannot be proven otherwise.
- ✕ A café, restaurant or bar preset → Akinaza serves service shops.
- ✕ An embed that loads before a click, or sound on autoplay → privacy, the CSP, and LCP.
- ✕ The same photo twice on a page, a stock default in the services menu, or real faces in the demo photos.
- ✕ « See it another way » on a real shop → the owner decides, in the composer. Only the demo shops get it, as the
  showcase.

## Slices

| Slice | Content | Issues |
| :-- | :-- | :-- |
| **S1** | Budgets and media guard: the measuring script, the JS lock, the five-screen check, and the migrated section order checked on a real-shape fixture | #401 |
| **S2** | The showcase finished: demo photos reviewed, captures on Bunny `pr-assets/`, budgets green on both demo shops | #403, #404 |
| **S3** | Content editors in the inspector: the wall, the board, the reviews, the reel TV with its links behind a facade, Boutique › Page as the one place | #311, #314, #313, #312, #317 |
| **S4** | The Cahier as preset v2 (paper, stamps, dividers, `TextStyle` roles) in `@krizaka/tokens` first, then « Update available » on the draft | #305, #304, #316 |
| **S5** | The booking journey wears the preset (a paper head, the « réservé » stamp, skeletons in the same boxes) | #315 |
| **S6** | Templates retired: the starters and presets replace #261's twelve templates, and the legacy columns and route are dropped | #261 |

Epic #236 is delivered across S2–S5. S1 comes first: nothing else ships to a real shop before the budgets hold.

## Consequences

- B54's design (`docs/design/cahier-storefront.md`) stays the visual reference, but its storage plan (`@2` schema,
  `shop_page.paper`) is replaced by preset versions.
- Owners will ask for freedom the catalogue does not give. The answer is a new variant in the library, never a free
  column.
- The composer is ours to maintain. In exchange, no third-party release can break the studio.

# ADR-004 — The customisable shop: the page as a document, Krizaka UI variants, look presets, the owner's composer

Status: accepted (2026-10-27); §2 « Options weighed » (the rejection of Puck) and §3's hand-made editor superseded by
[ADR-010](ADR-010-shop-editor-on-puck.md) (2026-10-31). Issue: krizaka/akinaza#398. Product half of krizaka-ui
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

## Addendum (2026-10-27, akinaza#478): one direction for the storefront, and six looks

Status: accepted. The founder (2026-10-27): the shop page's sections look dated: the closing call (a flat box with one
button), the wall (#477), the photo scroller (krizaka-ui#797) and the small TV (#469). He asks for one design pass and
**at least six looks**. One of them is « Krizaka », with our mascots. The looks are switched through « See it another
way » and chosen in the editor. This addendum folds in the decisions already taken: the mosaic gallery
(krizaka-ui#797, `ShopGallery` in krizaka-ui#798), the tidy pinboard wall (#477), the large TV and the hero « photo or TV »
(#469, `RetroTv` playlist in `@krizaka/ui` 3.68.0) and the compact footer that each app configures (#479).

Captures of today's page, one per existing composition, phone and desktop, both themes (demo shops on dev, 2026-10-27):
`https://krizaka-assets.b-cdn.net/pr-assets/akinaza/design-478/<look>-<phone|desktop>-<light|dark>.jpg`, where `<look>` is
`1-cahier` (Pattes, `?look=journal`), `3-editorial` (Cèdre, `?look=editorial`), `4-boutique` (Cèdre, `?look=gallery`),
`5-affiche` (Cèdre, compact) and `6-nuit-base` (Pattes, route). These are the **starting points**. The « Krizaka » look and
the « Nuit » surface do not exist yet, so they are described below.

### 1. A look is a preset, and it never touches the content

- ✓ **A look is a trade-agnostic look preset** (`look-cahier`, `look-krizaka`, …) in `@krizaka/tokens`. It names the
  paper, the surface, the faces, the accents, the density, the photo treatment, the motion, the mascots and **one variant
  per section type**. A trade starts on one look (`TRADE_PRESETS` becomes a look id). The 12 trade presets stay as
  published versions (§1: a version that has shipped is never deleted), and new pages use the looks.
- ✓ **Applying a look rewrites only the variants** of the sections the page already has: `applyLook(doc, preset)` in
  `@krizaka/ui/shop` keeps the order, the settings, the blocks and the text. It is pure and tested. The section list
  itself (what the shop shows) stays the owner's, and the starters stay for « Start from a composition ».
  → « See it another way » on a demo shop shows the **same content in six looks**, which is a real showcase, not six
  different pages.
- ✓ **In the editor**, the look is a radio group of six swatches (name, a still thumbnail, the accent chips), then one
  accent from the look's tested list. It applies to the draft only, and publishing goes through the diff (§3).
- ✕ **A look as a colour swap** (same variants, another accent) → refused by the founder. Each look sets a variant for
  every section and its own motion.
- ✕ **36 presets (6 looks × 6 trades)** → six times the AA matrix for the same result. A trade's difference is its
  content and its starter, not its look.

### 2. Every section, one direction (all looks)

Mobile first, **one primary action per section**, the page's only primary colour is the booking. The hero is painted
at once (never revealed, the LCP). Below the fold, every media box has a fixed ratio (CLS 0) and every interactive
widget is a lazy chunk loaded near the viewport.

| Section | Layout | The action | Motion | Perf · a11y |
| :-- | :-- | :-- | :-- | :-- |
| Hero | photo (`poster` / `split` / `banner`) or TV (`tv`), the owner's choice. Name, one line, three facts | « Réserver », chamfer (`shape="cut"`) | none | LCP = the poster image, phone-sized srcset, preloaded; the TV chrome and video after first paint (#469) |
| Next times | `booking.strip`: 3–6 slots as chips; closed today → the next opening's slots, never an empty bar | a slot | none | text slots, no JS until a tap |
| Services | `menu` (prices as text, dotted leaders) or `cards` / `index` | « Choisir » per row (secondary) | reveal soft | no images in the menu (ADR §6) |
| Photos | `gallery.mosaic` = `ShopGallery`: bento 2×2 + 4 on desktop, snap strip with « 1 / 12 » on a phone, lightbox (`Dialog`) | open a photo | none; lightbox swipe | zero JS until the lightbox; fixed ratios (krizaka-ui#797) |
| Wall | `gallery.wall` = tidy pinboard: 3 / 2 / 1 columns, `grid-auto-flow: dense`, tilt ±1–2° from the id, tape, one owner line (≤ 60 chars, Cahier face) | none | tape settles once (look `paper`) | alt from the line; tab order = visual order (#477) |
| Short videos | `video.tv` = the large `RetroTv` (full width, controls on hover or focus), playlist in the owner's order, 3 transitions | play | the look's transition; cut under reduced motion | poster first, muted by default, embeds behind a click (#469) |
| Reviews | `summary-cards` / `quote` / `strip`, the score as text | « Voir les avis » (quiet) | `NumberTicker` on the score (look `soft`/`lively`) | stars have a text equivalent |
| Bulletin | `board` (flyers, ≤ the settings' limit) or `banner` (one line) | none | none | dates as `<time>` |
| Visit | `card` / `split` / `map` (`map-gate`: the map loads on a click) | « Itinéraire » | none | no third-party request before a click |
| **Closing call** | **new `booking.closing`**: full width, the shop's photo or mark, the next free slot live (« Demain 9 h », a read-only `SlotPicker` preview), in the look's surface | **« Réserver »** cut, `lg`; secondary « Appeler » or « Itinéraire » | the slot chip appears once | server-rendered; the preview is text until a tap; legible in both themes |
| Footer | the shared `SiteFooter` with the app's config (#479): 2–3 short columns, one bottom line that wraps | none | none | no text overflow (the page-audit probe of #479) |

- ✓ **The closing call ships first** (the founder's first example). It replaces `CtaPanel` in a bordered box, which is
  « Prêt quand vous l'êtes » with one button and empty space in every capture.
- ✕ **A carousel with arrows and dots, masonry, or parallax** → more JS, a CLS risk, more a11y surface (krizaka-ui#797).

### 3. The six looks

Every value names a token of `@krizaka/tokens` or a variant of `@krizaka/ui/shop`, never a colour. Each look is proven
AA in both modes for each of its accents, and the visitor's dark / light choice is kept (a look defines both modes).

| | **Cahier** | **Krizaka** | **Éditorial** | **Boutique** | **Affiche** | **Nuit** |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| The idea | the artistic notebook (B54's reference) | Krizaka's own page, the flock at work | a magazine page, calm and airy | warm, the shop as a place | bold and modern, big type | calm, low light, the TV glows |
| Paper · surface | `seyes` (`kraft` for pets) · `paper` | `plain` · `ink` | `plain` · `paper` | `washi` · `warm` | `plain` · `contrast` | `plain` · `deep` (dark) / `dusk` (light) |
| Faces (title · note) | `display` · `cahier` | `product-display` · `mono` | `display` · `mono` | `display` · `cahier` | `poster` · `mono` | `product-display` · `mono` |
| Accents | akinaza, akinaza:accent-2 | krizaka, akinaza | akinaza:accent-2, akinaza | akinaza:accent-2, akinaza | akinaza, yomizaka | krizaka, akinaza |
| Density · photo | airy · warm, grain 1, radius none, `polaroid` frame | compact · none, radius xs | airy · none, radius none | airy · warm, radius xs | compact · none, radius none | compact · cool, radius xs |
| Hero | `split` | `poster` | `banner` | `poster` | `banner` | `tv` (poster LCP) |
| Services | `index` | `menu` | `menu` (2 columns) | `cards` | `menu` | `menu` |
| Booking strip | `strip` | `strip` | `strip` | `strip` | `strip` | `strip` |
| Gallery | `wall` | `mosaic` | `mosaic` | `mosaic` | `filmstrip` | `mosaic` |
| Video | `tv` | `tv` | `shorts` | `tv` | `shorts` | `tv` |
| Reviews | `quote` | `summary-cards` | `quote` | `summary-cards` | `strip` | `summary-cards` |
| Bulletin · visit | `board` · `split` | `banner` · `card` | `banner` · `split` | `board` · `split` | `banner` · `card` | `banner` · `map` |
| Closing | `closing` on paper, the « réservé » stamp | `closing`, the pigeon | `closing`, the photo | `closing`, the photo | `closing`, the mark, big type | `closing`, the photo |
| Motion | `paper`: tape settles, the stamp presses, TV `channel` | `soft`: `reveal(i)`, `NumberTicker`, the birds blink on screen only | `still`: fades, TV `crossfade` | `soft`: TV `slide` | `lively`: reveals staggered 70 ms, TV `slide` | `soft`: TV `crossfade` |
| Mascots | off | **on** (below) | off | off | off | off |
| Today | ≈ `pets-carnet` (capture 1) | — (described) | ≈ `salon-atelier` airy (capture 3) | ≈ `salon-atelier` compact (capture 4) | ≈ `salon-vitrine` (capture 5) | — (`6-nuit-base` is its starting composition) |

**The « Krizaka » look's birds** (`@krizaka/ui/mascots`, `tone="brand"`): at most one per section, each a different bird,
each one doing its job and never decoration (the mascots' rule). There is none on the first screen (LCP) and none on the
photos, wall or TV (the pictures are the subject). The words stay beside the bird, from the messages (EN/FR).

| Section | Bird | Why |
| :-- | :-- | :-- |
| Next times | the beaver | it builds the shop: bookings at work |
| Reviews | the owl | it reads: every review is read and verified |
| Policies | the falcon | it watches: the cancellation and payment rules |
| Story | the crane | it listens: the owner takes their time |
| FAQ | the flamingo | it answers |
| Closing call | the pigeon | it delivers the confirmation |

- ✓ The birds are server-rendered SVG. Their life loop runs only on screen and stops under reduced motion. They add no
  client JS to the public page (the ratchet).

### 4. Budgets, for every look

- ✓ Each look passes the §4 budgets on **both demo shops**: LCP ≤ 2.5 s, CLS 0 (≤ 0.02 hard), the JS ratchet, five
  phone screens for the compact salon, the page audit with axe in both themes. The perf gate in CI measures the six
  looks (`?look=`) and the TV hero. A look that fails is not offered.
- ✓ Motion: CSS only on the public page. There is no permanent `requestAnimationFrame` and no animation library. The
  TV and the lightbox are the only lazy chunks. Everything is still under `prefers-reduced-motion` and Save-Data.

### 5. Missing in krizaka-ui (libs first)

| Missing | Where |
| :-- | :-- |
| `booking.closing` (the closing call: photo or mark, a read-only next-slot preview, the primary and a secondary action) | `@krizaka/ui/shop/booking` |
| Look presets: trade-agnostic `look-*` ids; new keys `surface` (`paper` · `ink` · `warm` · `contrast` · `deep`/`dusk`), `motion` (`still` · `soft` · `paper` · `lively`), `mascots` (`off` · `on`), `photo.frame` (`none` · `polaroid`), the `poster` title face (from `@krizaka/fonts`); the six looks and their AA matrix | `@krizaka/tokens/shop-presets` |
| `applyLook(doc, preset)`, the look catalogue, the composer's look picker (radio group, swatches), a mascot slot per section driven by `mascots` | `@krizaka/ui/shop`, `@krizaka/ui/shop-composer` |
| `gallery.mosaic` rendered by `ShopGallery` | krizaka-ui#797 / #798 |
| `Wall` as the tidy pinboard (dense grid, deterministic tilt, one owner line) | `@krizaka/ui/wall` (the library half of #477) |
| `SiteFooter` taking a typed config (columns, bottom items, socials, legal line) | `@krizaka/ui/site-footer` (the library half of #479) |
| `RetroTv` wide in `hero.tv` and `video.tv` | shipped in 3.68.0 (krizaka-ui#796); adoption only |

### 6. Slices

The library first, then the Akinaza adoption, **the closing call first**. Each slice keeps §4 and §5 and carries its own
perf and a11y acceptance.

| # | Slice | Issue |
| :-- | :-- | :-- |
| L1 | `booking.closing`, the closing call | krizaka/krizaka-ui#802 |
| L2 | the six look presets, the new keys, the AA matrix | krizaka/krizaka-ui#803 |
| L3 | `applyLook`, the look picker, the mascot slots, the motion modes | krizaka/krizaka-ui#804 |
| L4 | `Wall` as the tidy pinboard | krizaka/krizaka-ui#805 |
| L5 | `SiteFooter` config | krizaka/krizaka-ui#806 |
| A1 | adopt the closing call | #480 |
| A2 | the hero « photo or TV » and the large TV | #469 |
| A3 | adopt `ShopGallery` | #481 (krizaka-ui#797) |
| A4 | the tidy wall and its editor | #477 |
| A5 | the compact, configured footer | #479 |
| A6 | the six looks in « See it another way » and the composer, the perf gate per look | #482 |

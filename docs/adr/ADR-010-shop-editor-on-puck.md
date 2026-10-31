# ADR-010 — The shop editor on Krizaka Composer, our fork of Puck: example shops, variables, an Orazaka assistant

Status: accepted (2026-10-31, the founder's decision; design delegated). **Amended 2026-10-31 (founder): a Krizaka
fork of Puck — `krizaka/krizaka-composer`, published as `@krizaka/composer` — replaces « Puck pinned behind a
`@krizaka/ui/composer` facade »**; the evidence and the spike below still hold, the decision, §1, §2, §6 and the slices
are rewritten. Supersedes **ADR-004 §2 « Options weighed »,
third line** (« ✕ Puck, Craft.js or GrapesJS behind a facade ») and ADR-004 §3's hand-made editor. The rest of ADR-004
holds: the page is a document stored in Akinaza's database, every section and variant comes from `@krizaka/ui`, looks
are presets, budgets and accessibility (§4, §5) and the refusals (§6). The fork's own
decisions are recorded in krizaka-composer `docs/adr/` (its ADR-001 restates §1 below).

## Context

- The founder (2026-10-31): for Akinaza's editor, adopt a turnkey library to go faster, do not reinvent the wheel, and
  give owners real services. Goals: **secure, uses our components (`@krizaka/ui`), user-friendly, customisable,
  evolutive, we can contribute upstream, at worst we fork**. Candidates named: Easyblocks, Puck, Craft.js. The founder
  then chose Puck (2026-10-31) and asked for the evaluation as the decision's evidence.
- What the hand-made composer (`@krizaka/ui/shop-composer`, ADR-007 §5 of krizaka-ui) costs us today:
  - **broken on desktop** (krizaka-internal#214): the preview squeezed between three fixed panels, the panels cannot
    fold, the look radios overlap their cards. The visual baseline accepted it.
  - **size-budget fights** (krizaka-ui#914): the fix needed three commits, one of them only « shrink the panels code
    to fit the size budget » (25.5 kB gz for hand-written outline, inspector, history and bridge).
  - every editor feature (fold, zoom, viewports, drag, tree, nested blocks) is ours to design, test and keep small.
- ADR-004 set the trigger to revisit: **nested free composition**. It is now asked for, with two more services
  (below): starting from complete example shops, and building with variables rather than raw values.

## Evidence (2026-10-31)

Read from the GitHub REST API and the npm registry on 2026-10-31; dependency counts from a clean `npm i` in a scratch
directory; « 6 months » = since 2026-05-01.

| | **Puck** (`@puckeditor/core`) | Craft.js | GrapesJS (+ `@grapesjs/react`) | Easyblocks | Plasmic | Builder.io |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| Licence (forkable) | MIT ✓ | MIT ✓ | BSD-3 core; Studio SDK commercial | **AGPL-3.0** ✕ | MIT SDK, editor is their cloud | MIT SDK, editor is their cloud |
| Latest release | **0.24.0, 2026-10-29** | core 0.2.12, 2025-02-14 | 0.23.8, 2026-10-15 · react wrapper last push 2025-02-20 | last push 2024-08-15 | continuous | sdk-react 5.4.2, 2026-10-20 |
| Activity, 6 months | 203 commits, 10 authors (3 core: 113 · 44 · 25); 66 issues opened, 70 closed | **0 commits** | 51+ commits, 12 authors | none | active | active |
| React 19 · App Router | peer `^18 \|\| ^19`; `@puckeditor/core/rsc` server render | peer ≤ 19, no RSC entry | framework-agnostic DOM editor | — | yes | yes |
| Our components as blocks, typed fields | ✓ any React component; `text` · `select` · `radio` · `number` · `array` · `object` · `slot` · `custom`; field groups and tabs (0.24) | ✓ components, fields hand-made | HTML/CSS components, React only through a wrapper | ✓ | ✓ code components | ✓ registered components |
| JSON in our DB, no SaaS | ✓ `{ root, content }` plain JSON | ✓ serialised tree | ✓ project JSON (HTML-first) | ✓ | ✕ hosted | ✕ hosted |
| Nested composition | ✓ `slot` fields | ✓ | ✓ | ✓ | ✓ | ✓ |
| Editor skin | **330 `--puck-*` CSS variables** (semantic layer) + `overrides` (header, actions, drawer, fields, field types, outline, preview, iframe) | headless: we draw all of it | its own chrome | own chrome | theirs | theirs |
| Size, dependencies | 36 direct, **106 packages** installed (55 MB; happy-dom 18 MB never reaches the browser) | 4 direct | large, own state | — | — | — |
| Accessibility | dnd-kit keyboard sorting; tabs with roles; to audit (below) | weak | weak | — | — | — |
| Security | plain JSON; rich text via TipTap only if we use a `richtext` field | ours | stores HTML and CSS | — | hosted | hosted |
| Extension API | `overrides`, `plugins`, `fieldTypes`, `resolveData`, `permissions` | resolvers | plugins (rich) | — | — | — |
| i18n | ✕ editor strings hard-coded in English (« Publish », « Outline », « Duplicate »…) | n/a | i18n module | — | — | — |

- ✕ **Easyblocks**: AGPL and no activity since 2024-08. ✕ **Craft.js**: no commit in 20 months, and headless means we
  would still draw the whole editor (today's problem). ✕ **GrapesJS**: HTML-first, its React wrapper is idle, and
  owners would write markup we must sanitise. ✕ **Plasmic, Builder.io**: the editor and the content live in their
  cloud; the shop's page must live in our database.
- ✓ **Puck** is the only candidate that is MIT, active this month, React 19, renders our own components with typed
  fields, keeps plain JSON in our database and lets us restyle the chrome with our tokens.

## The spike (scratch, not committed)

Vite + React 19, `@puckeditor/core` 0.24.0, `@krizaka/ui` 3.78.0. Three real shop sections (`HeroSection`,
`ServicesSection`, `BookingSection`) with their variants as radio fields, the root as `ShopFrame` with the look and the
density, the Akinaza brand. The editor chrome mapped onto `--kz-*` in one CSS file (45 variables), the header actions,
the radio and the text fields drawn by `@krizaka/ui` (`Button`, `RadioGroup`, `Input`) through `overrides`.

- **Save / load**: the stored JSON is **our `ShopPage`**, not Puck's data. Two pure functions, `toPuck(doc)` and
  `fromPuck(data)`, go both ways; a change of variant in the editor came back as `services · cards` in the saved
  document, which `parseShopPage` accepted.
- **Server-side validation**: a forged write (`variant: "<script>"`) was refused with its path
  (`sections.0.variant`, `sections.0.settings.focus`). Owner text is a string rendered as React text, never HTML.
- **Both themes** follow the tokens with no Puck-specific dark mode; the phone layout is Puck's own (bottom tabs:
  Blocks · Outline · Fields). Captures:
  `https://krizaka-assets.b-cdn.net/pr-assets/akinaza/adr-010-puck-spike/` `puck-desktop-dark.png`,
  `puck-desktop-dark-selected.png`, `puck-desktop-light.png`, `puck-phone-light.png`.
- **Found**: the preview `iframe` does not inherit `html.light` (the facade sets the theme class on the iframe's
  document through the `iframe` override); Puck's radii are not ours (2 px on controls, 0 on cards: mapped in the
  skin); the variant fields need thumbnails (our `thumbnails.tsx` becomes a custom field).

**Bundle** (production build, gzip -9, all JS of the page, same app, same sections):

| Page | JS | Over the sections alone |
| :-- | --: | --: |
| The three sections, no editor | 111 kB | — |
| Today's composer (`ShopComposer`) | 242 kB | **+131 kB** |
| Puck editor, loaded at once | 295 kB | **+187 kB** |
| Puck editor, every lazy chunk too (TipTap rich text, never loaded without a `richtext` field) | 418 kB | +307 kB |
| Puck's chrome CSS | +14.5 kB | — |
| The public page | unchanged | **0**: it renders `ShopPage` through our sections, Puck is never imported |

The editor costs ~56 kB gz more than today's composer, on one authenticated studio route, loaded as its own chunk.
The public page, the only page with a performance contract towards visitors, does not change.

## Decision

**The shop editor is Krizaka Composer: `krizaka/krizaka-composer`, our fork of Puck, published as `@krizaka/composer`.
The fork is the facade — there is no second layer in krizaka-ui. We change it where Puck does not hold what we need:
its data schema (versioned, validated with zod, nested blocks, content per locale, variables and bindings), its editor
words (FR/EN), its ergonomics (our tokens, `@krizaka/ui` controls, keyboard, accessibility), and we drop what we do not
use. Akinaza stores a composer document whose blocks are the `@krizaka/ui/shop` catalogue (`ShopPage` schema 2).
Owners start from complete example shops, build with variables, and can ask an assistant powered by Orazaka that
proposes changes they confirm.**

Why a fork rather than a facade (founder, 2026-10-31): the three things we need most — a validated, versioned,
multilingual document, an editor in French, our own controls — are not hooks Puck offers; a facade would hold them as
overrides of overrides and an adapter (`toPuck` / `fromPuck`) in front of a data format we do not own. In the fork they
are the code itself, and the generic fixes still go upstream.

### 1. The fork (`krizaka/krizaka-composer`, `@krizaka/composer`)

- ✓ **Repository**: `krizaka/krizaka-composer` (shared capability `composer` added to the naming standard of
  krizaka/.github `docs/standards/repositories.md`), a GitHub fork of `puckeditor/puck` so upstream pull requests come
  from it. Platform lane, CI profile `library` (ADR-018), SonarCloud, branch protection like every repository.
- ✓ **Licence**: MIT, kept. Puck's `LICENSE` (« Copyright (c) The Puck Contributors ») stays as is; a `NOTICE` names the
  fork, the upstream commit it started from and our changes; our files carry the same MIT licence.
- ✓ **Package**: `packages/core` becomes `@krizaka/composer` (one package; the editor and the server render
  `@krizaka/composer/rsc`). Exact pin in Akinaza, updated by Renovate one minor at a time with the composer journey
  green. Not published before the schema slice (C1).
- ✓ **Upstream is tracked, not followed**: remote `upstream` = `puckeditor/puck`; a weekly look at its releases;
  **security and bug fixes are cherry-picked** (one PR each, the upstream commit named); features only when we need
  them. **Generic fixes go back upstream** (editor i18n hooks, accessibility, field-type hooks), each its own upstream PR
  from the fork, linked from its internal issue. Our schema, words and skin are ours and are not proposed upstream.
- ✓ **What we change first**, in order:
  1. **The document** (C1): `ComposerDocument` — `{ schema, locales, defaultLocale, root, blocks }`, versioned
     (`schema: 1`, a pure `migrate` per version, never a silent shape change), **validated with zod** on read and write
     (`parseDocument` returns the paths of every error), **nested blocks** through typed slots (allowed types and depth
     per slot), **content per locale** (`LocalizedText = Record<Locale, string>`, the missing locale falls back to
     `defaultLocale` and is listed in the editor), **variables and bindings** (`{ var: "style.accent" }`,
     `{ bind: "shop.name" }`, resolved at render by the host). Puck's `{ root, content, zones }` is read once by a
     `fromPuckData` migration, never written.
  2. **The words** (C2): every editor string from catalogues (`en`, `fr`) through `@krizaka/i18n`; a test fails on an
     English string left in the French editor. The i18n hook (a `labels` prop) is proposed upstream.
  3. **The ergonomics** (C3): the chrome on `--kz-*` tokens (no `--puck-*` layer left), fields and actions drawn by
     `@krizaka/ui` (`Button`, `RadioGroup`, `Input`, `Select`, the variant thumbnails), keyboard reorder (Alt+↑/↓,
     « Move up / Move down » announced in a live region), the preview iframe titled and themed (`html.light`), the
     layout guard of krizaka-internal#214.
  4. **What we drop** (C1): `create-puck-app`, `field-contentful`, `plugin-emotion-cache`, the docs app and recipes,
     the `richtext` field and TipTap (owner text is never markup), `external` fields and browser-side `resolveData`
     calls (references are resolved by the product, server-side), the upstream publish workflows.
- ✓ **The config is derived from the catalogue**: each `defineSection` of `@krizaka/ui/shop` (type, variants, zod
  settings, slots, limits) becomes a composer block through `defineBlock`; the mapping lives in Akinaza (the only shop
  product) and moves to a package the day a second product needs it — never a hand-written editor config.
- ✕ `@puckeditor/*` is imported nowhere (dependency-cruiser rule, every repository); `@krizaka/composer` only on the
  studio routes, never on a public page.

### 2. The document (schema 2, `@krizaka/ui/shop`)

| Change | Shape | Why |
| :-- | :-- | :-- |
| Nested blocks | `Section.blocks[].slots?: Record<string, Block[]>`, depth ≤ 2, the block types each slot allows listed by its `defineSection`; total blocks per section ≤ 24 as today | the revisit trigger: a column of services beside a photo, a card with its own chips — still from the catalogue |
| Variables | `ShopPage.style: { look: { id, version }, accent, face, density, radius, motion }`, each value an id from the look's tested list | one « Style » panel, applied everywhere; never a raw colour, size or font |
| Bindings | text fields may hold `{ bind: "shop.name" \| "shop.logo" \| "shop.phone" \| "shop.address" \| "shop.hours" }` instead of a string | the shop's identity is data: renamed once, right everywhere |
| Content per locale | owner text is `LocalizedText` (`{ fr, en }`), the shop's locales listed in the document | a bilingual shop is one page, not two |
| Envelope | `ShopPage` schema 2 **is** a `ComposerDocument` whose blocks are the shop catalogue | one format from the editor to the database: no adapter to keep |

- ✓ **Migration 1 → 2 is pure and lossless**: `migrateShopPage` lifts `preset` and `density` into `style`, wraps
  owner text as `{ <shop locale>: text }`, adds nothing else; every starter, demo and real-shape fixture migrates and
  parses (property test over the catalogue). Published versions are migrated in memory on read and written back on the next save (ADR-004
  §1). Nothing in `shop_page_versions` changes shape: `doc` stays jsonb, `schema` becomes 2.
- ✓ **The server is the judge**: the draft route (`/api/walker/page/draft`) keeps `parseShopPage` on every write (422
  with the path); publish keeps the diff, rollback keeps the last 20 versions, audit keeps the section keys.

### 3. Starting points: five example shops

- ✓ **The owner starts from one of five complete example shops**, each a full document on the demo seed, one per kind
  and look: the salon (Cèdre, *Boutique*), the dog walker (Pattes, *Cahier*), the barber (*Affiche*), the esthetics
  studio (*Velours*), the clothing boutique (*Atelier*, ADR-007's first new kind). They live in `@krizaka/ui/shop`
  (`exampleShops`) beside the starters, are shown as still thumbnails and as the live demo shops, and pass the ADR-004
  §4 budgets.
- ✓ **« Start from this shop » copies the structure and the style, binds the shop's own data** (its services, photos,
  reviews, name and contact through bindings) into a new draft; the owner publishes after the diff. A real shop's
  published page is never rewritten.

### 4. Variables: one « Style » panel

- ✓ Puck's root fields are the **Style** panel: the look, the accent, the title face, the density, the radius scale and
  the motion level — each a radio group of the look's tested values (#1043's owner choices, moved here). Changing a
  variable changes every section at once, in the draft.
- ✓ The shop's identity (name, logo, phone, address, hours) is edited where it already is (Boutique › Identity); the
  page binds it.
- ✕ A colour picker, a font upload, pixel values → AA cannot be proven (ADR-004 §6, unchanged).

### 5. The assistant (« Help me build my page »), powered by Orazaka

- ✓ **Docs RAG first**: the editor's usage documentation (`docs/editor/`, EN/FR: how to start, every section and its
  variants, the variables, the looks) is indexed by an Orazaka Studio pack; the assistant answers from it, with links
  to the pages it used.
- ✓ **Suggestions are actions the owner confirms**: an answer may carry typed commands (`addSection`, `setVariant`,
  `setStyle`, `startFromExample`); the editor shows them as a diff and applies them on « Apply » through Puck's
  `dispatch`, onto the draft, undoable. Never a silent edit, never a publish.
- ✓ **Through Orazaka's API only**, behind an `AssistantPort` in Akinaza (`apps/web/lib/assistant.ts`, the same shape
  as `lib/translation.ts`), off by default in the settings (`assistant.editor.enabled`), with a per-shop daily quota
  the administrator sets, and the credits of Orazaka's pricebook. It sends the question, the locale and the
  document's structure (types, variants, style), never a customer, a booking or a price.
- ! The pack (index of `docs/editor/`, the command schema) is Orazaka-lane work and gates slice A4.

### 6. Upstream

- ✓ We contribute upstream, from the fork, what others will need: the editor i18n hook, the accessibility fixes the audit
  finds, field-type hooks. Each contribution is its own issue (C2, C3), linked to the upstream PR. A refusal changes
  nothing for us: the fix already lives in the fork.
- ✓ Sync: security and bug fixes cherry-picked within a week of an upstream release; a feature only when an issue asks.
- ! A divergence grows with each change of the document and the chrome; we accept it — the document is ours, and the
  canvas, drag and tree we keep close to upstream so their fixes still apply.

### Options weighed

- ✓ **A Krizaka fork of Puck (`@krizaka/composer`), our document stored** (amended) → the editor's hard parts (canvas,
  drag, tree, zoom, viewports, nested slots, phone layout) come from an active MIT project; the schema, the words and
  the skin are ours in the code, not in overrides.
  ! We carry the fork: cherry-picks, our own releases, a growing divergence; dnd-kit 0.4 stays; +56 kB gz on the studio
  route against today's composer (less once C1 drops TipTap and the unused fields).
- ✕ **Puck pinned behind a `@krizaka/ui/composer` facade** (this ADR's first decision) → the schema, the French editor
  and our controls would be overrides plus an adapter in front of a format we do not own; upstream i18n has no date.
- ✕ **Keep the hand-made composer** → every editor feature is ours to build; #214 and #914 show the cost.
- ✕ **Store Puck's data as the document** → our renderer, validator and migrations would follow Puck's format
  (`zones` → `slot` already moved once); the adapter keeps them independent.
- ✕ **Craft.js, GrapesJS, Easyblocks, Plasmic, Builder.io** → see the evidence table.

## Accessibility

- ✓ WCAG 2.2 AA in both themes for the editor too: axe on the composer journey in CI, a keyboard-only journey (add a
  section, change its variant, reorder, publish), the preview iframe titled, every field labelled.
- ✓ The keyboard reorder of ADR-004 §3 stays: the outline override gives each row « Move up / Move down » and Alt+↑/↓,
  announced in a live region, on top of dnd-kit's keyboard sorting.
- ✓ The layout guard of krizaka-internal#214 carries over: at 1440 × 900 the preview is ≥ 50 % of the width, no two
  interactive elements overlap, each radio sits inside its card.

## Performance

- ✓ The public page never imports `@krizaka/composer` (dependency-cruiser rule + the JS ratchet of ADR-004 §4).
- ✓ The editor is one lazy chunk on Boutique › Page; its budget is measured in Akinaza on the built route: eager JS
  ≤ 200 kB gz over the app shell, CSS ≤ 20 kB gz. `@krizaka/composer` has its own size-limit (editor entry and
  `rsc` entry), measured in its repository; the budget never again forces the editor's design.

## Removed after the switch (krizaka-ui, slice L4)

Deprecated in the minor that follows A2, removed in the next major (changeset `major` for `@krizaka/ui`):

| Removed | Replaced by |
| :-- | :-- |
| `shop-composer/composer.tsx`, `outline.tsx`, `inspector.tsx`, `settings-form.tsx`, `history.ts`, `commands.ts` (+ `commands.test.ts`), `keys.ts`, `composer.test.tsx`, `ShopComposer.stories.tsx` | the canvas, tree, history and fields of `@krizaka/composer` |
| the preview bridge: `connectShopPreview`, `postToPreview`, `readPreviewMessage`, `PreviewMessage` (`shop/preview.ts`, `preview.test.ts`) | Puck's iframe |
| the size-limit entry `./shop-composer` (25.5 kB) | `@krizaka/composer`'s own size-limit |
| `registry/examples/shop-composer/`, the `shop-composer` page of ui.krizaka.com, its rows in `docs/inventory/ui-usage.*` | a « Shop editor » page of ui.krizaka.com linking `@krizaka/composer` |
| kept and moved: `look-picker.tsx` (Style panel field), `thumbnails.tsx` (variant field), `diff.ts` (publish diff), `messages.ts`; `fields.ts` (zod → fields) moves into the composer | — |

In Akinaza, `components/boutique/ShopComposerPanel.tsx` is replaced by the composer's mount, and the engine flag is
removed one release after A2 is green.

## Work this decision makes obsolete

| Item | What happens |
| :-- | :-- |
| krizaka-ui#914 (shop-composer panels fold, look cards align) | closed once this ADR is merged, comment pointing here; no more work on it |
| krizaka-internal#214 (composer broken on desktop) | the bug is closed by A1; its layout guard moves into A1's journey |
| krizaka-internal#1043 (advanced owner looks) | the looks and the document guards stay; its composer controls (`setFace`, `setMotion` in the old composer) are not merged and move to the Style panel (L3 / A2) |
| krizaka-internal#635 (six looks in the composer's look picker) | the picker part moves to L3 / A2; « See it another way » stays |

## Slices (plan order)

Issues in krizaka-internal, sub-issues of krizaka-internal#1889. Rewritten by the amendment: the fork comes first.

| # | Repo · lane | Content | Depends on |
| :-- | :-- | :-- | :-- |
| **C0** (krizaka-internal#1904) | krizaka-composer · platform | the fork: `krizaka/krizaka-composer`, protection, CI on the org's reusable workflows, README, NOTICE, AGENTS.md, registry and naming entries, Sonar project; upstream publish workflows removed; nothing published | — |
| **C1** (#1891) | krizaka-composer · platform | `@krizaka/composer`: the `ComposerDocument` schema (versioned, zod, nested slots, per locale, variables and bindings), `fromPuckData`, the drops; the first release on npm (trusted publishing) | C0 |
| **C2** (#1897) | krizaka-composer · platform | editor words FR/EN through `@krizaka/i18n`, the test against English left in French; the i18n hook proposed upstream | C1 |
| **C3** (krizaka-internal#1905) | krizaka-composer · platform | ergonomics: the chrome on `--kz-*`, `@krizaka/ui` fields and actions, keyboard reorder, a11y journey (axe), themed preview, the #214 layout guard; a11y fixes proposed upstream | C1 |
| **L2** (#1892) | krizaka-ui · platform | `ShopPage` schema 2 as a composer document: nested slots, `style`, bindings, per-locale text; `migrateShopPage` 1 → 2; parser limits | C1 |
| **A1** (#1893) | akinaza · akinaza | Boutique › Page on `@krizaka/composer` behind an admin setting (`editor.engine`), the config derived from the catalogue, routes unchanged, schema 2 read and written | C2, C3, L2 |
| **L3 / A2** (#1894) | both | the five example shops and « Start from this shop »; the Style panel; bindings resolved at render; the old engine removed from Akinaza | A1 |
| **A3** (#1895) | akinaza · akinaza | the editor's usage docs (`docs/editor/`, EN/FR), then the assistant behind `AssistantPort` (off by default, quota, confirm-to-apply) | A2, the Orazaka pack |
| **L4** (#1896) | krizaka-ui · platform | removal of the old composer (table above), major changeset, the ui.krizaka.com page swapped | A2 green one release |

## Consequences

- The editor's mechanics come from Puck; the fork, its document, its words and its skin are ours to keep.
- Owners get nested composition, five complete starting points, one Style panel and an assistant, without a free
  colour or markup anywhere.
- We carry a fork of a 0.x project: upstream fixes come in as cherry-picks, our releases are our own, and the stored
  document no longer depends on upstream's format.

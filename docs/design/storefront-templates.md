# Storefront templates — proposal (phase 1)

Issue: krizaka/akinaza#261. Part of epic #236 (the shops platform). Status: **proposal, awaiting « validé »**. No code changes in this PR.

Oussama (2026-10-23): « proposer aussi quelques templates pour chaque boutique ». A shop owner starts from a finished storefront that suits
their trade, not from a blank page. The public pages follow the Cahier (artistic notebook) style; the owner's back office stays plain Krizaka UI.
Akinaza serves service businesses and never restaurants or bars (AGENTS section 2).

Shared vocabulary with the default-media issue (#267): **shop types** `salon · coaching · workshop · cleaning · pets · consulting`; **media slots**
`cover` (16:9, image or loop) · `gallery` (4:3) · `service` (3:2) · `logo` (1:1, optional) · `about`/`team` (default avatars) · later `announcement`, `reel`, `wall`, `share`.

## 1. What a storefront is made of today

`apps/web/components/shop/Storefront.tsx` renders a `StorefrontView` (`lib/storefront.ts`, pure, tested) as ordered **sections**:

| Section id | Rendered with | Data |
| :-- | :-- | :-- |
| `services` | `Section` + `CardGrid` + `ServiceCard` | `services`, prices from cents, « popular » from real bookings |
| `team` | `Avatar` + `Badge` (a state per first name) | staff, today's schedule |
| `hours` | `OpeningHours` | schedules, days off |
| `zones` | `Badge` list + the map (`ZoneMap`) | zones with a position |
| `gallery` | `MediaGallery` | `shop_media` role `gallery` |
| `wall`, `reels`, `announcements`, `reviews`, `follow` | placeholders until their features land (#232-#236) | admin switches `features.shop*` |
| (fixed) hero | `CoverHero` | `shop_media` role `cover`, logo, status, areas |
| (fixed) trust | `Section` + `DescriptionList` + `ButtonLink` | story, contact, policies |

The owner already controls **which sections show and in what order** (`shop_page.sections`, #237), the logo, and the languages (#258). What the owner cannot do is start
from a trade-specific look. A template is therefore **a starting point for the things the owner already controls, plus a look**: it must not own their content.

## 2. What Krizaka UI already gives (`@krizaka/ui` 3.50.0, `packages/ui/src/<export>`)

Everything below is an export of the package (`node_modules/@krizaka/ui/package.json`), nothing invented.

- **Page frame and templates**: `page` (`Page`, `Section`, `SectionHeading`, `Facts`), `page-hero`, `cover-hero`, `landing-page`, `gallery-page`, `product-page`, `contact-page`, `legal-page`, `error-page`, `status-page`.
- **Storefront blocks already used**: `cover-hero`, `service-card`, `card-grid`, `media-gallery`, `opening-hours`, `slot-picker`, `avatar` (+ `avatar/defaults`), `badge`, `description-list`, `map`, `site-footer`.
- **Blocks available for templates**: `photo-grid`, `media-grid` (a grid of media with ratios), `profile-card` (the owner or a team member), `cta-panel` and `action-bar` (the booking call), `link-card`, `argument-card` (a card that argues: icon, hook, facts), `section-backdrop` (a coloured transition), `stage-banner`, `glow-card`, `marquee`, `video-player` and `vertical-video` (a loop or a reel), `meta-row`, `list`, `page-index` (a sticky in-page index), `tabs`, `stepper`, `sticky-action` (a phone's booking bar).
- **The Cahier**: `TapedPhoto` is merged in krizaka-ui (#542) and not released yet. **Not released**: `Polaroid`, `PinnedNote`, `ShopSign`, the textured `Wall` surface (krizaka-ui#537, #540), `RetroTv` (#539), and the text-style control `TextStylePicker`/`StyledText` (#561).
- **Brand and fonts**: the `.brand-akinaza` hue (forest green + copper, `@krizaka/tokens/brands/scoped.css`), the family hues `data-hue` (cobalt · sky · cyan · indigo · steel · ink), the curated faces of `@krizaka/fonts`, light and dark tokens `var(--kz-*)`.

### Ready-to-file krizaka-ui blocks (nothing missing is hand-made here)
1. **`PaperSurface` + paper tokens** (the spec of akinaza#238): `--kz-paper-{dot-grid,kraft,ruled,plain}`, grain by inline SVG, no image. *Needed by every Cahier template.*
2. **`Badge tone="ink"` (stamp)** and **hand-drawn `Divider`** variants (three shapes). *Needed to give the three layouts their Cahier look.*
3. **`ServiceCard variant="index"`** (a ruled index card, price stamped), with lift and reduced motion. *Used by the « Carte » layout.*
4. **`StorefrontSection` contract** is app-level (see option C), not a krizaka-ui block; only if a second product reuses it does it move to `@krizaka/ui`.

Until 1 to 3 are released, templates use the existing blocks with `data-hue` and the type scale; the Cahier pieces arrive as a later template version (section 7).

## 3. Three ways to model a template

**A. Templates as data, one generic renderer.** A schema of ordered sections, each with a block id, props and media slots; one renderer walks it. The shop stores a *copy* it edits.
**B. Templates as React compositions**, one component per shop type.
**C. A mix.** The section components stay fixed and tested (as today); the template is **data that selects, orders and varies them** (`variant`), names the media slots and the look; the shop stores a *reference* (`template id@version`) plus its own overrides, never a copy of the content.

| Criterion | A (data + generic renderer, stored copy) | B (React per type) | C (fixed sections + template as data, reference + overrides) |
| :-- | :-- | :-- | :-- |
| The admin configures everything, settings in the DB | good: all data | poor: a template is code, offering or hiding one needs a deploy | **good**: the catalogue is data; which are offered, the default per type and the flag are DB settings |
| The owner switches template without losing content | weak: the copy diverges; switching = a merge of two copies | weak: content mixed with layout | **good**: content lives in shop fields, media and translations; the template is only order, variants, look |
| Versioning when a template improves | hard: copies to migrate | a deploy changes every shop | **good**: `id@version`; a shop keeps its applied version, sees « update available », applies by choice |
| Text-style values (#561) | in the copy | in code | **good**: a `style` value per role, template gives the defaults, the owner overrides |
| Default media per slot (#267) | per slot in data | in code | **good**: slots named in the template, defaults resolved by shop type |
| i18n FR/EN | texts inside templates (duplicated per language) | texts in messages | **good**: no text in templates; labels are messages keyed by section id |
| Performance, no CLS, SEO, a11y, dark/light | depends on the renderer's quality; blocks anonymous | best control | **good**: the section components are the tested ones (fixed aspect boxes, tokens), the data only chooses |
| Testability | a schema parse + renderer snapshot | a test per composition | **good**: parse every template, render each with fixtures, assert section order and slots |
| Reuse by other products' public pages | good (generic) | none | **good**: the schema and resolver are product-neutral; the section components are the product's |
| Cost | a block registry with prop typing per block: large, easy to over-generalise | duplication across types: every fix 6 times | small: reuses what exists |

**Recommendation: C.** It is the only option that keeps the owner's content independent of the layout, lets the administrator hold the catalogue as data, and versions without migrating
copies, while reusing the section components and tests that already exist. A is a page builder (« arbitrary page building » is already refused in `docs/UX_DECISIONS.md`); B hard-codes the trade into code.

## 4. ADR (draft, to land in `docs/adr/ADR-004-storefront-templates.md` with phase 2)

- **Decision**: a template is a versioned, validated record of **section order, section variants, media slot names, a hue and default text styles**, held as data in `packages/core` (a zod schema, parsed at build) and selected by the shop with `shop_page.template_id` + `template_version`. The page renders the existing section components in the template's order with its variants; the owner's own section order and visibility (`shop_page.sections`) remain **overrides** over the template.
- **Rejected A (stored copy / generic builder)**: copies diverge from improvements, switching is a merge, it grows into a page builder. **Rejected B (a component per type)**: trade-specific code, every improvement six times, no admin control.
- **Costs**: variants multiply (each section component must support its variants and be tested); templates cannot do what no section component does (a new block means a krizaka-ui or section component first); the registry of section ids is a contract between catalogue and renderer.
- **Content is never part of a template**: texts are the shop's (and their translations, #258), media are the shop's or the defaults of its type (#267).

## 5. The catalogue (data, 2 templates per shop type, 6 types)

Three **layouts** carry the structure; each type gets two templates, which differ by layout, paper, hue and text styles. All sections are existing ids; Cahier pieces marked † join in a later version (section 7).

| Layout | Intention | Section order (after the hero) | Services shown as |
| :-- | :-- | :-- | :-- |
| **L1 Vitrine** | the trade's atmosphere first | services · gallery · team · hours · zones · trust | `ServiceCard` grid |
| **L2 Carte** | booking first, for a page people open to book | services (compact) · hours · team · trust · gallery | compact `ServiceCard` list (`variant="index"` †) |
| **L3 Histoire** | the owner's story first, a neighbourhood notebook | trust (story) · gallery (`TapedPhoto` †/`MediaGallery`) · services · hours · team · zones | `ServiceCard` grid, story above |

| Shop type | Template id | Name and intention | Layout | Hue | Paper † | Default text styles (roles: title / body / price) | Media slots (defaults of #267) |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `salon` | `salon-vitrine` | « Salon » — light, airy, mirrors and plants | L1 | `brand-akinaza` | plain | display 3xl 700 / body md / price md 600 | cover (loop), gallery ×4, service ×3 |
| `salon` | `salon-carte` | « Sur rendez-vous » — the menu of cuts and colour | L2 | `brand-akinaza` | ruled | display 2xl 600 / body md / price lg 700 | cover (image), service ×3 |
| `coaching` | `coaching-vitrine` | « Studio » — energy and space | L1 | `cyan` | dot-grid | display 3xl 700 / body md / price md 600 | cover (loop), gallery ×4 |
| `coaching` | `coaching-histoire` | « Mon approche » — the coach's story first | L3 | `sky` | kraft | display 3xl 600 italic / body lg / price md 600 | cover, gallery ×4 (taped †) |
| `workshop` | `workshop-histoire` | « L'atelier » — craft, tools, hands | L3 | `steel` | kraft | display 3xl 700 / body md / price md | cover, gallery ×4 (taped †) |
| `workshop` | `workshop-carte` | « Réparations et sur mesure » — a price list | L2 | `steel` | ruled | display 2xl 700 / body md / price lg 700 | cover (image), service ×3 |
| `cleaning` | `cleaning-vitrine` | « Frais et net » — bright, simple packages | L1 | `sky` | plain | display 3xl 700 / body md / price lg 700 | cover (loop), gallery ×4, service ×3 |
| `cleaning` | `cleaning-carte` | « Forfaits » — what is included, at what price | L2 | `cyan` | dot-grid | display 2xl 600 / body md / price lg 700 | cover (image), service ×3 |
| `pets` | `pets-histoire` | « Le quartier » — walks, photos, a note after each outing | L3 | `brand-akinaza` | kraft | display 3xl 700 / body lg / price md | cover (loop), gallery ×4 |
| `pets` | `pets-vitrine` | « Promeneur » — zones and the team | L1 | `brand-akinaza` | dot-grid | display 3xl 700 / body md / price md | cover, gallery ×4 |
| `consulting` | `consulting-carte` | « Bureau » — calm, hourly and flat fees | L2 | `indigo` | plain | display 2xl 600 / body md / price lg 600 | cover (image) |
| `consulting` | `consulting-histoire` | « Mon travail » — approach and cases first | L3 | `ink` | ruled | display 3xl 600 / body lg / price md | cover, gallery ×4 |

Text styles are the values of krizaka-ui#561's `TextStyle` (`font`, `size`, `weight`, `leading`, `tracking`, `align`, `case`, `italic`, `tone`), three roles: `title`, `body`, `price`; fonts come from `@krizaka/fonts` only.

### Wireframes (desktop, then phone)

```
L1 VITRINE (desktop)                                   L1 VITRINE (phone)
+--------------------------------------------------+   +----------------+
| bar                                              |   | bar            |
| +----------------------------------------------+ |   | [cover 16:9   ]|
| | COVER (image or loop) · logo · Open now      | |   | name · Open now|
| | name · area · [Book]                         | |   | [Book]         |
| +----------------------------------------------+ |   | Services       |
| Services   [card][card][card]                    |   | [card]         |
| Photos     [4:3][4:3][4:3][4:3]                  |   | [card]         |
| Team       (o) (o) (o)    Hours  mon-fri ...     |   | Photos [4:3]x2 |
| Zones      chips + map                           |   | Team (o)(o)    |
| Story / contact / policies                       |   | Hours          |
+--------------------------------------------------+   | Contact        |
                                                       | [sticky Book]  |
L2 CARTE (desktop)                                     +----------------+
| compact hero: name · Open now · [Book]           |   L2 CARTE (phone)
| Services (list)          | Hours / team          |   | name · [Book]  |
|  Cut ........ 45 min  $45 [Choose]               |   | Services list  |
|  Colour ..... 90 min  $95 [Choose]               |   | Hours          |
| Story / contact          | Photos (strip)        |   | Story · Photos |

L3 HISTOIRE (desktop)                                  L3 HISTOIRE (phone)
| COVER + the owner's one line                     |   | cover          |
| Story (avatar, text)     | Photos taped (2 col)  |   | Story          |
| Services [card][card][card]                      |   | Photos         |
| Hours · Team · Zones                             |   | Services       |
```

## 6. Data model, migration, admin side

- **Catalogue** (code as data): `packages/core/src/storefront-templates/` — `templateSchema` (zod): `{ id, version, shopTypes[], layout, sections: { id, variant, visible }[], slots: Record<SlotId, { default: "type" | "none" }>, hue, paper, textStyles: { title, body, price }, minUiVersion }`. Parsed at module load; a test parses every template.
- **Shop** — migration `0030_shop_template.sql` on `shop_page`:
  `template_id text NULL`, `template_version integer NULL`, `sections_custom boolean NOT NULL DEFAULT false` (the owner has reordered or hidden sections),
  `style jsonb NOT NULL DEFAULT '{}'` (the owner's `TextStyle` overrides per role), `shop_type text NULL CHECK (...)` (the type of #267). No row or NULL = today's page.
  Classified in `packages/db/src/tenancy.ts` as `shop`; tenant-isolation sweep covers the new route.
- **Admin settings** (`@krizaka/settings`, audited): `features.storefrontTemplates` (flag), `storefront.templates.offered` (subset of the catalogue ids), `storefront.templates.default.<shop-type>` (choice among that type's templates).
- **Applying a template**: sets `template_id@version`; the section order/visibility come from the template **unless `sections_custom`**, in which case the owner is asked (« keep my order / use the template's »). Switching never touches fields, media or translations.
- **Upgrading**: a template improves by publishing `id@version+1`; the shop keeps its applied version; the editor shows « update available » with a preview; applying is the owner's choice and follows the same rule.
- **Rendering**: `buildStorefront` resolves the template (shop's id@version, else the default of its type, else today's order), the renderer maps section id + variant to the existing section component; every media slot resolves to the owner's media, else the default of the type (#267), never blank.

## 7. Cross-cutting

- **i18n**: no text in templates; names and intentions are messages `console.templates.<id>.{name,intent}` in FR and EN; labels of sections already exist.
- **Performance / SEO / a11y / theme**: sections keep fixed aspect boxes (CLS 0), the page stays server-rendered, JSON-LD (`LocalBusiness`) is unchanged by the template, every template passes the contrast check in both themes (tokens only, hue by `data-hue`), keyboard order follows the visual order.
- **Cahier pieces** (†, once released): paper and ink stamp, `TapedPhoto`, `Polaroid`/`PinnedNote`/`ShopSign`, the wall, `RetroTv`. They arrive as new template versions (`id@2`), so a shop on `@1` is untouched until its owner applies the update.
- **Reuse**: the schema and the resolver are product-neutral; the section components stay the product's. If another product wants templates, the schema moves to `@krizaka/ui`.

## 8. Implementation plan (phase 2, each step one PR, tests and acceptance)

| # | Step | Tests / acceptance |
| :-- | :-- | :-- |
| 1 | `templateSchema`, the 12 templates as data, a resolver (`resolveTemplate(shop)`) in `packages/core` | every template parses; every `shopType` has at least two; every slot id is known; every text key exists in FR and EN; no template names a missing section id |
| 2 | Migration 0030, reads/writes, admin settings, tenancy classification | db tests; the settings bounds; tenant sweep; a shop with no row renders as today |
| 3 | Refactor `Storefront.tsx` to a section registry + variants (no visual change under the default template) | the existing storefront tests unchanged; snapshot of section order per template; CLS guard |
| 4 | The editor: « Look » tab picker with a live preview, « keep my order / use the template's » | component tests EN/FR; preview renders each template with fixtures |
| 5 | Switch template keeps the content; versions and « update available » | integration: switching changes only order/variants/look; an old `@1` renders unchanged after `@2` ships |
| 6 | The demo shop on one template per type, with the default media (#267) | captures in both themes to Bunny pr-assets |
| 7 | Text styles (after krizaka-ui#561 ships) | stored value parsed server-side (`parseTextStyle`), contrast warning shown |
| 8 | Cahier pieces as `@2` versions (after krizaka-ui#537, #540, #539, paper and ink) | per-template captures; the update flow from step 5 |

## 9. Open questions for Oussama

1. Two templates per type is the proposal; is a third (a bolder, photo-led one) wanted for some trades?
2. Must the owner be able to mix two templates' sections (it pushes toward a builder), or is « pick, then reorder and hide » enough? (Proposed: enough.)
3. Text styles per role (`title`, `body`, `price`) or per section? (Proposed: three roles, simpler and consistent.)
4. Should a new shop be offered the template picker at creation, or only after its first publish? (Proposed: at creation, with the default of its type preselected.)

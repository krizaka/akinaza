# ADR-007 — Every kind of shop on one core: offer kinds, products and variants, stock, drops, lookbooks, presets

Status: **proposed** (2026-10-30). Issue: krizaka/akinaza#591 (Feature). Accepted by the CTO, with a summary for the founder;
nothing below is built before that.
Founder request (2026-10-30): clothing boutiques — the alternative-chic neighbourhood shop, the street-wear shop — must have
their page on Akinaza, with tools for that kind of shop and « ultra advanced » animations, on an architecture that serves
**every** kind of shop.

## Context (main, 2026-10-30)

| Piece | Today | Where |
| :-- | :-- | :-- |
| What a shop sells | **time only**: `services` (duration, capacity, price, tax category, « from » price) booked into `appointments` (staff time, `EXCLUDE`) and `bookings` (a seat) | ADR-001, `packages/db/src/schema.ts` |
| The kind of shop | **three overlapping lists**: `shops.kind` (salon · boutique · services · other: gates the counter), `shops.business_type` (professional · pets: the vocabulary), `shop_page.shop_type` (salon · coaching · workshop · cleaning · pets · consulting: the templates) | `core/shop.ts`, `core/vocabulary.ts`, `core/storefront-templates/schema.ts` |
| Excluded businesses | restaurants, cafés, bars, bakeries with on-site consumption (Revenu Québec's SRM / MEV-WEB, which Akinaza is not) | `core/shop.ts` `EXCLUDED_KINDS` |
| The page | a versioned document of sections with Krizaka UI variants and six looks, edited in the composer | ADR-004 and its addendum |
| Search | Postgres (`shop_search` read model, trigram + full text), one typed filter schema | ADR-006 |
| Money | integer cents, GST/QST per line by tax category, invoices and an append-only tax ledger; payments through the shop's own processor are « Soon » | `core/tax.ts`, `core/ledger.ts`, ADR-003 |
| Media | the admin-configured storage provider, https addresses kept in the database | `shop_media`, `apps/web/lib/media-storage.ts`, `media-upload.ts` |

Two findings shape the decision:

1. **The three type lists are already a fork in waiting.** A fourth vertical would add a fourth list. The decision replaces
   them with one preset.
2. **The issue's fourth archetype, a café-boutique, is outside Akinaza.** A café with on-site consumption must use a
   certified SRM; Akinaza is not one and the exclusion stays. The hybrid archetype is a **barbershop-boutique** instead
   (booked cuts plus grooming products at the counter and online): same shape, inside the rules.

## Options weighed

| Option | For | Against | Verdict |
| :-- | :-- | :-- | :-- |
| A. One polymorphic `offers` table (kind + JSON details) | one query lists everything | services lose their constraints (duration, capacity, `EXCLUDE` through appointments); stock and SKU rules in JSON can't be enforced by the database; every reader switches on `kind` | refused |
| B. **One table per offer kind, one catalogue read model over them** | each kind keeps rules the database enforces; the page, search and the counter read one shape; salons and walkers don't change | a union view to maintain; a new kind is a new table | **chosen** |
| C. Generic attributes (EAV) | any vertical without a migration | no constraints, slow filters, unreadable data; the opposite of « data before code » done right | refused |
| D. A separate commerce product (or a hosted shop builder behind ours) | fastest to a cart | a second client file, a second catalogue, a second invoice and ledger; the hybrid shop gets two tools; data leaves our residency | refused |

## Decision

### 1. Domain model

**Offer kinds on one catalogue.** `service` (bookable time, unchanged) and `product` (a physical item) now; `event` and
`bundle` later, with their shape written now so nothing has to move:

- an **event** is a service sold for a fixed time with N seats (a workshop, a launch evening): one `appointments` row with
  capacity N, which ADR-001's group model already supports. It needs a « fixed sessions » list on the service, not a new kind
  of stock;
- a **bundle** is a priced list of other offers (a cut + a product; three products). It is a table of components that points
  to services and variants, and is priced as one line.

| Concept | Table (new unless said) | Rules the database keeps |
| :-- | :-- | :-- |
| Product | `products`: shop, names and descriptions FR (required) / EN (optional, falls back to FR), product type, tax category, status (`draft` · `active` · `archived`), size guide, care text | a product without a variant can't be `active` |
| Option | `product_options`: name FR/EN, position, values (label FR/EN, optional swatch: a colour token or an image) | at most 3 options a product, 100 variants a product |
| Variant | `product_variants`: option values, SKU, price in cents, compare-at price, barcode, weight, image | SKU unique per shop; price ≥ 0; one variant per combination of values |
| Catalogue (read) | `catalogue_items`: a view over `services` and `product_variants` (id, kind, names, price, « from », image, status) | read-only; what the page, search and the counter read |
| Location | `stock_locations`: one per shop by default (the shop) | a shop has exactly one default location |
| Stock | `stock_levels(variant, location)`: on hand, reserved, low-stock threshold | `0 ≤ reserved ≤ on_hand` (`CHECK`) |
| Stock ledger | `stock_movements`, append-only: receive, sale, return, adjust, reserve, release, with the order or the person behind it | never updated or deleted (trigger), like the tax ledger |
| Collection | `collections` (+ `collection_items`): a named, ordered list of products; a **drop** is a collection with `launches_at` (and an optional `ends_at`, a per-client limit) | dates in UTC, shown in the shop's time zone |
| Lookbook | a **section of the page document** (ADR-004), not a table: frames (image, caption) whose hotspots point to variants | a hotspot to a product that is gone is dropped at render, never a dead link |
| Order | `orders`, `order_lines`: fulfilment (`pickup` · `local_delivery`; `shipping` later), state, the client; each line a **snapshot** (name, variant label, unit price, tax category at the time of sale) | totals = sum of lines + taxes; a paid order issues an invoice through the existing ledger |
| Return / exchange | `returns`, `return_lines`: reason, refund amount, restock or not | a refund never exceeds what was paid on the line; an exchange is a return plus a new order |

**Stock is reserved, never oversold.** Checkout reserves with one statement
(`UPDATE stock_levels SET reserved = reserved + q WHERE variant = … AND on_hand - reserved >= q`): zero rows means « sold
out », whoever is second. A reservation expires after a shop setting (default 15 min) and is released by the paid or failed
event from the processor, or by a sweep with an injected clock. The counter (#605) and the online shop read and write the
**same** `stock_levels`: shared stock is the default. Several locations are kept for later; the model already has them.

**Order states are a pure state machine** in `@akinaza/core` (`draft → reserved → paid → ready → collected | delivered`,
plus `cancelled` and `refunded`/`partly refunded`), tested like `invoice-state`. The processor's webhook is the only writer
of « paid » and « refunded » (ADR-003). Money stays integer cents.

**What a hybrid shop changes:** one catalogue, one client file, one invoice that can carry a cut and a pomade, one ledger.
The booking flow lists services; the cart lists products; the counter lists both.
**What stays the same for a salon or a walker:** nothing. Their preset doesn't enable products, the product tables stay
empty for them, and no code path they use changes.

### 2. A shop type is a preset (data), not a fork

One catalogue, `SHOP_PRESETS` in `@akinaza/core` (versioned like the storefront templates). It replaces the three lists:

| Field | Example (`clothing-boutique`) |
| :-- | :-- |
| `id` | `clothing-boutique` (others: `salon`, `barbershop`, `pets`, `coaching`, `workshop`, `cleaning`, `consulting`, `barbershop-boutique`) |
| `offerKinds` | `["product"]` (a hybrid: `["service", "product"]`) |
| `vocabulary` | `{ dependants: false, visitReports: false }` and the message namespace (`console.vocabularies.<id>`) |
| `sections` | the default sections and variants of the page (`hero lookbook products:tilt collections hours trust`) |
| `templates` | the looks offered first (ADR-004 addendum) |
| `counter` | whether the counter may open (still refused for every excluded business) |
| `productTypes` | the defaults the item form offers (top, bottom, outerwear, shoes, accessory), each with its size guide template |
| `explore` | the Explorer category (ADR-006) |

- `shops.preset_id` is added and back-filled from the three columns. The old columns are read through one function for
  one release, then dropped. `vocabularyOf`, `posAllowed` and the template filter read the preset.
- **Guard:** an ast-grep rule, `no-preset-branch`, refuses a preset id compared with a string literal outside
  `core/shop-presets.ts` (the existing `no-enum-string-compare` doesn't see it). A vertical that needs a behaviour adds a
  **flag** to the preset, never a branch on its name.
- A new vertical is a row in the catalogue, its messages and its default images (#611), reviewed like any data change.

### 3. Presentation and motion

The « ultra advanced » animations are Krizaka UI pieces, tried in Krizaka Lab first and promoted when they pass its
checklist (Krizaka UI only, keyboard, designed reduced motion, both themes, 360 px, no permanent animation frame, CLS 0,
settings as data):

| Piece | Lab | What the owner chooses |
| :-- | :-- | :-- |
| Product card: tilt on hover, swatch-driven image change, video on hover | krizaka/krizaka-lab#95 | the card variant of the `products` section |
| Lookbook scroll story with hotspots | krizaka/krizaka-lab#94 | the `lookbook` section and its frames |
| Drop: teaser, countdown, then the collection | krizaka/krizaka-lab#93 | the `drop` section linked to a drop collection |
| Motion presets (calm · lively · editorial) | krizaka/krizaka-lab#91 (after #8) | one setting of the look, bounded |
| 360° view (an image sequence, ≤ 24 frames, loaded on intent) | to file in the Lab with #95 | per product, optional |

- New section types in the page document: `products`, `collections`, `lookbook`, `drop`. They go through the same schema,
  variants, versions and publication diff as the others (ADR-004).
- **Budgets** (on top of ADR-004 §4): only the first product image of the first screen is a priority image; a hover video is
  fetched on pointer intent, never on a touch screen by default, never autoplayed with sound; every media box has its aspect
  ratio (CLS 0); under reduced motion the tilt and the story stop, and a swatch still changes the image, instantly. The
  per-look performance check (`check:perf`) gains a clothing page fixture.
- The owner picks looks and section variants; **Akinaza never hand-codes one shop's page.**

### 4. Owner tools for a clothing boutique

- **Photo-first entry:** drop N photos, get N item drafts (one photo each, the file name as a first title). A draft is never
  published by itself. A draft of title and description from the photo is an Orazaka call, decided in ADR-008 (#592).
- **CSV entry and imports** (#607): one importer with column mappings as data (a generic profile, plus the Shopify and Square
  product export profiles), a dry run that shows every line and its error, idempotent by SKU, audited. CSV parsing through a
  trusted library (papaparse, MIT) behind a `@krizaka/*` facade, never imported directly by the app.
- **Variant matrix editor:** options × values → a grid of SKU, price and stock, with fill-down and « same price for all ».
- **Size guides:** a table per product type, edited once, attached to products.
- **Drop scheduling:** a date and time in the shop's time zone, a preview of the page before and after, a per-client limit.
- **Stock:** receive, adjust (with a reason), low-stock list on the Today page, shared with the counter.

### 5. Commerce and the law (Québec)

Akinaza prepares, the shop is the merchant. Sources are the laws themselves; every line marked ⚖ goes to the lawyer review
(krizaka/.github#250).

- **Taxes:** clothing and accessories are taxable supplies at GST 5 % and QST 9.975 % (`standard`; no children's clothing
  relief in Québec). The existing tax module and ledger apply per line; a shop under the small-supplier threshold sells
  without taxes as today. Akinaza prepares the figures and never files them.
- **Distance contracts** (Consumer Protection Act, CQLR c. P-40.1, ss. 54.1–54.16): before the client confirms, the checkout
  shows the merchant's identity and contact, the description of each item, the itemised price, delivery costs, taxes and
  total in Canadian dollars, the delivery or pickup date, and the cancellation, return, exchange and refund policy (s. 54.4).
  The client can review, correct and refuse before accepting (s. 54.5). A copy of the contract is e-mailed right away (the
  law gives 15 days, s. 54.7). The cancellation cases of s. 54.8–54.9 (information missing, copy not sent, not delivered
  within 30 days of the date agreed) and the merchant's 15-day refund duty (s. 54.13) are states of the order, not free text. ⚖
- **Price shown:** the price shown is the total the client pays, except GST/QST (s. 224 c); delivery is shown as a line,
  never added at the last step.
- **Returns:** a shop may refuse returns of goods that aren't defective, but the policy it states is shown on the product
  page, at checkout and in the confirmation, and is versioned. A « final sale » never removes the legal warranty
  (ss. 37–38, s. 10), and the wording says so. ⚖
- **French:** a product's name and description exist in French (Charter of the French language, ss. 51–52); English is
  optional. ⚖
- **Law 25:** an order holds personal information (name, contact, address, purchase history). Purposes: fulfilment is
  `service`; anything using purchase history for promotion needs `marketing` consent (existing purposes). A delivery address
  is erased once the order is delivered and its return window closed; the invoice is kept six years, as today. No
  recommendation from purchase history (profiling) by default; if it ever comes, it is disclosed and off until chosen
  (s. 8.1). The order module gets its section in the privacy impact assessment (`docs/privacy/efvp.md`) before it opens (s. 3.3). Photos of
  people (models) need their consent: the upload asks the owner to confirm it (Civil Code arts. 35–36) and records the answer. ⚖
- **Payment:** through the shop's own processor, **Stripe Connect Standard** (krizaka/krizaka-ts#281): the shop is the
  merchant of record, the money never passes through Krizaka, **one platform Connect webhook** for all shops (shops declare
  none), card data never in Akinaza (hosted fields, PCI SAQ A), 0 % on cards (ADR-003). Nothing of checkout is built before
  #281 is released.
- **Drops and bots:** a per-client limit, the rate limiter (`apps/web/lib/rate-limit.ts`) on checkout, and a reservation that expires. No queue
  system now.

### 6. Architecture

Ports and adapters, data before code, the same layering as ADR-001 and ADR-006:

| Port | Pure part (`@akinaza/core`) | Adapter |
| :-- | :-- | :-- |
| Catalogue | product and variant schemas, price resolution, the preset catalogue | `packages/db` (Drizzle), `catalogue_items` view |
| Inventory | the reserve/release rules, low-stock signal | `packages/db`: one-statement reservation, ledger trigger |
| Orders | the order state machine, totals and tax lines, the return rules | `packages/db` + the invoice ledger |
| Payments | events without a vendor (ADR-003) | `@krizaka/payments` (Connect Standard, #281) |
| Media | allowed types and sizes, alt text FR/EN required | the admin-configured storage provider (never the server's disk) |
| Search | the typed filter schema extended with options (size, colour) and offer kind | Postgres: `shop_search` gains a `product_search` read model (trigram + full text, unaccented FR/EN), kept by triggers |

« jean brut, taille 32, Saint-Henri » parses into a text part (« jean brut »), an option filter (size = 32) and a zone; the
Explorer can then show the shops that have it in stock, through the same compiled conditions as ADR-006 (no hand-built SQL).
Every new table is declared in `tenancy.ts` (the tenancy test fails otherwise) and in the privacy export and erasure where it
holds personal data (orders, returns).

### 7. Validation: four archetypes, no code branch

| Archetype | Preset | Offer kinds | Sections | Tools used | Code branch |
| :-- | :-- | :-- | :-- | :-- | :-- |
| Alternative-chic boutique | `clothing-boutique`, look « éditorial » | product | lookbook, products:swatch, collections, hours | photo-first entry, matrix, size guides | none |
| Street-wear shop | `clothing-boutique`, look « lively » | product | drop, products:tilt, lookbook | drops with a per-client limit, CSV import | none |
| Salon (services only) | `salon` | service | services, team, hours, reviews | today's tools | none (unchanged) |
| Barbershop-boutique (hybrid) | `barbershop-boutique` | service, product | services (with a picture each, #598), products, hours | calendar, counter (#605), stock | none |

The two clothing shops differ only by preset data and looks. The hybrid differs by `offerKinds`. The salon doesn't see the
change.

## What it costs

- About ten new tables, one view, one read model and their migrations, each with a PostgreSQL test (constraints, the
  reservation race, the ledger trigger).
- A privacy impact assessment and a set of lawyer-review points before the order module opens to real clients.
- Four to five Lab pieces promoted into Krizaka UI before the matching sections ship: this is Platform-lane work and sets the
  pace of the presentation slices.
- Storage grows with product photos (several per variant). It stays on the admin-configured provider, and its cost shows on
  the admin's storage page.
- The preset migration touches the three existing type columns: one release of compatibility reads, then a drop.
- Not done now, on purpose: shipping and carriers, several locations, gift cards and memberships (#606), marketplaces, a
  queue for drops.

## Consequences

- A new vertical is a preset row, messages and default images, not a schema or a code path. The guard makes a branch on a
  preset name fail the lint.
- Services and products stay separate tables with their own rules; the catalogue view is the one shape everyone reads.
- The counter (#605) is unblocked as soon as the product kind and stock land: it uses the same stock and the same invoice.
- The section types of the page wait for their Lab pieces; the data model doesn't.

## Slices (issues filed when this ADR is accepted, in this order)

1. **Presets** — `SHOP_PRESETS`, `shops.preset_id` back-filled, the three readers moved, the `no-preset-branch` rule.
2. **Products and variants** — tables, the catalogue view, the owner's item form and variant matrix (console), EN/FR,
   persona journey « an owner adds a jacket in three sizes ».
3. **Stock** — locations, levels, ledger, receive/adjust, low-stock on Today; the reservation race test.
4. **Collections and drops** — tables, scheduling, the date gate with an injected clock.
5. **Page sections** — `products`, `collections` (default variants first), then `lookbook` and `drop` as their Lab pieces are
   promoted.
6. **Orders: pickup** — checkout through #281, disclosures, confirmation e-mail, the order state machine, invoice; privacy
   impact assessment; persona journey on Stripe test mode.
7. **Returns and exchanges** — refunds through the processor, restock.
8. **Owner tools** — photo-first drafts, size guides; CSV and Shopify/Square imports with #607.
9. **Search** — `product_search` and the option filters in the Explorer.
10. **Local delivery** — zones reused, delivery fee as a line.

**For the Platform lane:** the Lab pieces above (#95, #94, #93, #91 and a 360° view), their promotion into `@krizaka/ui`
(domain `commerce`), an editable grid for the variant matrix if `DataTable` can't carry it, the CSV facade, and
`@krizaka/payments` #281 (orders and refunds on Connect Standard).

## Sources

- Consumer Protection Act, CQLR c. P-40.1 (ss. 10, 37–38, 54.1–54.16, 224): <https://www.legisquebec.gouv.qc.ca/en/document/cs/P-40.1>
- Act respecting the protection of personal information in the private sector, CQLR c. P-39.1 (ss. 3.3, 8.1): <https://www.legisquebec.gouv.qc.ca/en/document/cs/P-39.1>
- Charter of the French language, CQLR c. C-11 (ss. 51–52): <https://www.legisquebec.gouv.qc.ca/en/document/cs/C-11>
- Civil Code of Québec, arts. 35–36: <https://www.legisquebec.gouv.qc.ca/en/document/cs/CCQ-1991>
- Revenu Québec, mandatory billing in the restaurant and bar sectors (SRM): <https://www.revenuquebec.ca/en/businesses/mandatory-billing/>

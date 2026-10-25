# Akinaza — the design direction (October 2026)

Refs krizaka/akinaza#324. Status: **proposal, phase 1 (docs only), waiting for « validé »**. Nothing here is implemented, and no
Phase 2 issue is filed before the validation. Claude (CTO) reviews.

This document sets the direction of the whole product, so that we know what to build and what not to build before more UI lands.
It builds on, and never contradicts:

- `docs/ux/2026-10-full-review.md` and its Errata (the K slices; K1, K2, K4, K6, K7 and K8 have shipped);
- `docs/UX_DECISIONS.md`;
- `docs/design/cahier-storefront.md` (#303, validated) and `docs/design/storefront-templates.md` (#261, validated);
- `AGENTS.md`: Krizaka bricks only, no AI word, money in integer cents, the ledger is the authority, « Akinaza prepares; the merchant files »;
- the brand decisions: **the products stay professional Krizaka UI** (2026-10-22), **the public shop pages are the artistic notebook** (2026-10-23, #236);
- the workspace ADR krizaka/krizaka-ts#89 (tags, status sets, saved views, bulk actions).

Captures and mockups are on Bunny, never in the repository:
`https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/` (`audit/`, `mockups/` for direction A and `mockups-b/` for direction B). The demo persona is **Éric**, the owner of
« Krizaka (démo) » (a professional-services shop: fictional clients, demo amounts, fake tax numbers), and one of his clients
(the seed's « Café du Parc inc., démo ») for the client space. **The seed's client is a café, which Akinaza does not serve** (Québec requires a certified sales recording module for cafés, restaurants and bars, AGENTS § 2): every mockup uses a service business instead (« Studio Lumen inc. (démo) »), and the seed is renamed in Phase 2 (D0).

---

## 0. The direction in six decisions

> **Chosen (Oussama, 2026-10-24): direction B, refined as B2 (§ 4c).** The six decisions below stand; B2 changes how the screens look and are built.

1. **One product register, two places for art.** The owner app, the staff's phone, the client space, the account, the sign-in, the
   phone app and the Mac app are plain Krizaka UI in Akinaza's forest green. The artistic notebook lives on the shop's public
   pages only. The line is drawn surface by surface in § 2.2, and one small move is proposed: the visit report wears the shop's
   thin paper head.
2. **The Cahier's organising ideas come in, its look does not.** Five ideas enter the app: numbered steps, a margin column for
   notes and explanations, signed notes, a quiet hierarchy with no box in a box, and a count on every list. Paper, ruled lines,
   the serif, the typewriter mono, stamps and tape stay out.
3. **Every list is organised the same way** (krizaka-ts#89). Tags with a colour marker go on clients and invoices. Saved views
   go on every list, with the address as the state. Bulk actions are limited to tag, untag and export. Statuses that come from
   the ledger or from check-in are shown and filtered, never moved by hand.
4. **Every screen tells its three states.** Empty shows the beaver at 120 px, what will fill the screen and one action.
   Loading shows skeletons in the same boxes. An error is an alert in place with « Réessayer ». A day whose figures are all zero
   shows its empty state, not a row of zeros.
5. **One map on every device.** The web, the phone and the Mac use the same five places, with the same words, in the same order:
   Aujourd'hui · Clients · Factures · Livres · Boutique. The account sits under the avatar. The phone's « Calendar » and
   « Settings » tabs go away.
6. **Krizaka first.** What the screens need and the bricks lack becomes a krizaka-ui, krizaka-ts or krizaka-motion issue
   (§ 6). Nothing is copied here.

---

## 1. The audit (2026-10-24, www.akinaza.com, `v0.1.0`, @krizaka/ui 3.50)

Method: Playwright (Chromium) at **1440 × 900** and **360 × 780**, dark and light, French, Montréal time; e-mail addresses masked.
19 screens × 4, signed out, as Éric and as his client: 76 captures and `audit.json` (the title, the `h1`, horizontal overflow,
unnamed buttons and console errors of each page). Pattern: `audit/<persona>/<screen>-<desktop|phone>-<dark|light>.png`, plus
`-first.png` for the first screen. Examples:
[today](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/audit/owner-eric/today-desktop-dark.png) ·
[today, phone](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/audit/owner-eric/today-phone-light.png) ·
[clients](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/audit/owner-eric/clients-desktop-light.png) ·
[a client](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/audit/owner-eric/client-file-desktop-dark.png) ·
[invoices](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/audit/owner-eric/invoices-desktop-dark-first.png) ·
[an invoice](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/audit/owner-eric/invoice-desktop-light.png) ·
[new invoice, phone](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/audit/owner-eric/invoice-new-phone-dark.png) ·
[books](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/audit/owner-eric/books-desktop-dark.png) ·
[Boutique](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/audit/owner-eric/boutique-desktop-light.png) ·
[team](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/audit/owner-eric/boutique-team-desktop-dark.png) ·
[account](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/audit/owner-eric/profile-desktop-dark.png) ·
[client space](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/audit/client/client-space-desktop-light.png) ·
[storefront, salon](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/audit/public/storefront-salon-desktop-dark-first.png) ·
[storefront, studio](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/audit/public/storefront-studio-phone-light.png) ·
[home](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/audit/public/home-phone-dark.png) ·
[sign-in](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/audit/public/sign-in-desktop-light.png) ·
[404](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/audit/public/not-found-desktop-dark.png) ·
[audit.json](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/audit/audit.json).

**What the K slices fixed** (measured): every page has exactly one `h1`; no page scrolls sideways at 360 px; no console error on
any page, so React #418 is gone; no unnamed button; the rail has five places; the shop is in the header; Boutique is one hub; the
account is under the avatar. The headings use the sans face (Atkinson Hyperlegible Next) and the figures a code mono, as the
2026-10-22 decision asks.

**What is left**, ranked by how much it costs the owner (A blocks or misleads, B slows or looks unfinished, C polish):

| # | Impact | Screen | Finding | Goes to |
| :-- | :-- | :-- | :-- | :-- |
| 1 | A | Factures | The table's chrome is still English (« Search numéro », « Search client », « 22 rows », « Columns », « Export CSV »). The number column takes 40 % of the width while the client's name wraps over five lines. « Mois » repeats « Émise le ». Every « À payer » badge is the same grey, so overdue invoices do not stand out. K3 was never filed. | D2 |
| 2 | A | Nouvelle facture | Three fixed service lines and one free line, no running total, the money field reads « $CA0,00 », and the title appears twice (`h1` and the card's `h2`). On a phone the form runs 1 150 px with no total in view. | D3 |
| 3 | B | Une facture | The page's `h1` is the document's « Facture / Invoice » instead of its number. There is no state chip. « Envoyer la facture » floats above the document on the left and « Modifier » on the right. There is no aside for deliveries and the chain. | D2 |
| 4 | B | Aujourd'hui | A day without appointments (Éric's Saturday) spends 520 px of a phone on « 0 · 0,00 $ · — » before its empty state. The figures sit in a box inside a box (a `Widget` around a divided `StatGrid`). The beaver is drawn at 24 px (krizaka-ui#623). The strip does not mark closed days. « Toutes les factures » is heavier than the widget's title. | D4 |
| 5 | B | Clients · a client | There is no search, filter or tag (K3b of the Errata). « Total dépensé » uses the client's words, not the owner's. On the file, the invoice dates wrap over three lines, the « Statut » column is empty, and « Aucune note » is plain text with no way to add one. | D5 |
| 6 | B | Espace client | The request form is open for every shop (#323). The invoices are ten raw links (« Ouvrir la facture KZ-00022 · 310,43 $ ») with no state. The Loi 25 card repeats per shop, with the danger button beside the download. | D7 |
| 7 | B | Vitrine | The salon still wears the consulting set of proposed images (notebooks, a meeting table): G2 of the review persists (#267's migration). The shop's page opens under Akinaza's product bar (« Vue d'ensemble · La boutique de démonstration · GitHub · Se connecter »), so the shop is not the first thing a visitor reads. The Cahier pieces are not live yet (#305 → #316). | Q5, #305 |
| 8 | B | App mobile (code read, see below) | Five tabs that differ from the web (Today · Calendar · Invoices · Clients · Settings). Today shows the raw ISO date (« 2026-10-22 ») between two ghost buttons, and visit cards instead of the agenda. There is no loading state, an error is a red « offline » line, the empty state has no beaver, and the quick invoice has no client picker (the client comes from the link only), no line removal and its totals as text. `locale === "fr" ? …` ternaries in `VisitCard` and `invoices/new` break the text rule. | D8 |
| 9 | C | App Mac | A Tauri window on the hosted web app, so the screens are the same. The menu's order (⌘1 Today, ⌘2 Invoices, ⌘3 Books, ⌘4 Clients, ⌘5 Shop) is not the rail's order. #79 still describes a point-of-sale terminal (cash drawer, ESC/POS, tips) that the product excludes. | D9, § 5 |
| 10 | C | Boutique | The page's `h1` is the section (« Identité »), so « Votre boutique » and the shop's name read as captions. The section card repeats « Identité » a third time. | D6 |
| 11 | C | Every app address | The shop is a UUID in the address (`/app/18680bde-…/aujourdhui`), although it has a slug (`krizaka-demo`). | Q4, #278 |
| 12 | C | Tokens | `--kz-font-display` is Young Serif and `--kz-font-mono` Courier Prime in @krizaka/tokens 3.53, and `brands/akinaza.css` overrides neither. The product renders the sans today only through its setup, so any `font-display` class is one upgrade away from the Cahier serif. | krizaka-ui#626 |

**Not reached, and why.** The phone app was **read in code, not captured**: there is no build of `apps/mobile` on this Mac, and a
simulator build would load the machine for one picture. Its captures come in D8, from the simulator, as Éric. The Mac app shows
the web pages above. The booking journey past the service page needs a slot and a client account (it is #315's design).
Aujourd'hui was captured on a Saturday, when Éric's shop is closed; the mockups show a weekday with demo appointments.

---

## 2. The direction

### 2.1 The brand: how Akinaza shows

- **The colour does one job at a time.** The forest green (`--kz-accent`, hue 130) marks the one primary action of a screen,
  the current place on the rail, links, the « now » line and the selected day. The copper (`--kz-accent-2`, hue 22) is the
  second note only: the mark, the beaver's warmth, one tag hue. Copper is never a button and never a status. Status colours
  keep their meaning: success = done or paid, warning = in progress or overdue, danger = cancelled or no-show,
  neutral = booked or due. A status is always a tone **and** a word.
- **The beaver works; it does not decorate.** It appears once per screen at most, only in a state: `welcome` (sign-in, 160 px),
  `empty` (an empty day, no client, no invoice, 120 px), `thinking` (a search without result, 120 px), `success` (the tax
  figures ready, 72 px inline) and the 404. It never appears on a working screen that has content. It is never drawn at 24 px
  in a circle (krizaka-ui#623).
- **The mark once per width**: in the rail on a desktop, in the header on a phone. The shop's own logo (when it has one) goes in
  the header's shop chip. This is the only place where the shop's identity enters the owner app.
- **Krizaka is named only in the footer** and the legal mentions (AGENTS § 3), as today.

### 2.2 The Cahier inside a professional app

The Cahier is an **organising vision** before it is a look. Five of its ideas enter the owner app, written in plain Krizaka UI:

| Cahier idea | In the app | Example |
| :-- | :-- | :-- |
| **Numbering** | The steps of a flow are numbered in the left margin (`1 · Pour qui ?`, `2 · Quoi ?`, `3 · Conditions`). Identifiers are set in mono: invoice numbers, the FPZ-500 line numbers already on Livres, a slug. | [new invoice](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups/invoice-new-desktop-light.png) |
| **The margin** | From 1 024 px, a right column for what explains: the meaning of a figure (#260), the client's contact, a note. Small text, a hairline on its left, never a card. On a phone it folds under the content. | [a client](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups/client-desktop-dark.png) |
| **Notes** | The owner writes notes on a client file (and later on an invoice). Each note is signed and dated (« — Éric, 21 oct. ») and shown in the margin. | idem |
| **Quiet hierarchy** | One `h1` per page. `h2` for sections. No box inside a box: hairlines separate the content, and at most one framed surface per region. One primary action per screen (Errata 2). | [today](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups/today-desktop-dark.png) |
| **Folios** | Every list says how many it holds and where you are: « 3 clients », « 22 factures · 1 – 12 », « 3 factures à payer · aucune en retard ». | [clients](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups/clients-desktop-dark.png) |

**What stays out of the app:** paper and grids, the red margin rule, Young Serif, Courier Prime and the Krizaka Cahier pen, stamps,
tape, tilt, doodles and grades. These belong to the sites and to the shop's public pages.

**The line, surface by surface:**

| Surface | Register | Why |
| :-- | :-- | :-- |
| The shop's page `/s/<slug>`, its services, the neighbourhood, the community pieces (wall, post-it, RetroTv, Polaroid, index cards, stamps) | **The notebook** (#236, `cahier-storefront.md`) | A place you visit: the shop's charm sells |
| The booking journey, steps 1 to 4 | The shop's **thin paper head** only. Fields, `SlotPicker` and buttons are plain Krizaka controls (#315) | The booking is the shop's business: fast, clear, accessible |
| The visit report `/report/<token>` | **Proposed move**: the shop's thin paper head, as on the journey. The body (note, photo, time) stays plain | It is the moment the client remembers (UX_DECISIONS § 5, peak-end), and it comes from the shop, not from Akinaza |
| The public invoice `/invoice/<token>`, the invoice document, the tax figures, the e-mails | **The document**: sober, printable, the invoice's own language, no paper or stamp | A legal document must never look like a decoration, and a « payée » stamp could be read as a receipt |
| Boutique › Page (the studio, #317) | Plain Krizaka UI around a **framed live preview** of the notebook, labelled « Aperçu » | The owner edits plainly and sees the art only as a preview |
| Everything under `/app` (owner, manager, staff, the client space, the account), sign-in, sign-up, the 404, the administration, the phone app, the Mac app | **Plain Krizaka UI**, Akinaza green | Professional, fast and the same everywhere (2026-10-22) |
| akinaza.com (the product's home) | Plain Krizaka UI with the brand, like every product site | The 2026-10-22 decision; the art is shown through the demo shop |

**Should the line move?** Two moves were considered and refused:

- *Bringing a touch of the notebook into the owner app* (a paper Today, the shop's hue on the frame). Refused: the owner works in
  Akinaza between two clients. The tool must read the same in every shop and every trade, and the shop's art would compete
  with the figures. The owner sees their notebook in the framed preview and in the header chip's logo. That is enough.
- *Putting the whole booking form on paper.* Refused: a form on texture loses contrast and trust, and #315 already gives it the
  thin head.

One move is proposed: **the visit report wears the shop's thin paper head** (Q2). It is the same rule as the booking journey,
applied to the one page the shop sends after the service.

### 2.3 Motion: what moves, and why

The app takes the **product register** of Krizaka Motion (krizaka-motion#57), CSS only, transforms and opacity, never on arrival:

- **Nothing moves when a page opens.** App screens use no `data-reveal`. `MotionObserver` stays mounted for the storefront.
  A professional screen is painted at once.
- **What changed moves once.** A row changed by someone else (a booking arrives, an invoice is paid, through
  `@krizaka/realtime`) gets one wash of the accent (600 ms). Under reduced motion it gets a static « nouveau » marker for 3 s.
  A bulk change washes its rows together, once.
- **Rows are inserted and removed** with opacity and a 4 px translate (160 ms in, 120 ms out). No height is animated.
- **A figure that changes** crossfades (150 ms). There is no `NumberTicker` in the app: counters belong to the sites.
- **The « now » line** moves to its new minute without an animation. **A side sheet** comes from its edge (200 ms in,
  140 ms out; a fade under reduced motion). **A button that waits** shows its own `loading`. **Skeletons** pulse, and stand
  still under reduced motion.
- Exit is faster than entry, and every motion can be interrupted. No permanent `requestAnimationFrame`, no animation library.

### 2.4 Density and typography

- **Faces:** the sans of Krizaka UI for everything; a code mono only for identifiers (invoice numbers, FPZ-500 lines, slugs,
  API keys); tabular digits for every amount and time. This becomes a brand-level token switch (krizaka-ui#626), never an
  app-local override.
- **Scale:** the page `h1` at display-md, weight 700 (today 800, one step heavier than it needs). Section `h2` at title-lg.
  Card and row titles at body-md, weight 600. Body text at 16 px (never under 16 px in a field on a phone). Captions at
  13 px minimum. Prose at most 72 characters per line.
- **Density:** comfortable by default. Rows are 48 px on a desktop, and targets 44 px minimum (56 px for the agenda's rows on a
  phone). The agenda is the one dense surface. Invoices on a desktop use `density="compact"` once their columns are fixed (D2).
- **Widths:** lists go full width within `--kz-page-max`. Forms use one column up to 48 rem. A detail page has a main column
  plus a 20 rem margin. A creation flow has its main column plus a 20 rem total that stays in view.
- **On a phone:** figures go on one line (krizaka-ui#631). The agenda never cuts a client's name (krizaka-ui#628). A creation
  flow's total and action sit in a `StickyAction` that the tab bar never covers (krizaka-ui#630).

### 2.5 Empty, loading and error

| State | Rule | Blocks |
| :-- | :-- | :-- |
| **Empty** | What is empty, what will fill it, one way forward. The beaver at 120 px (`empty`, or `thinking` for a search). A day whose figures are all zero shows only the empty state. | `EmptyState` + `Mascot` (krizaka-ui#623), [states](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups/states-desktop-light.png) |
| **Loading** | A `loading.tsx` per owner route, drawn in the same boxes as the page (the stat line, three agenda rows, the table's head), so nothing shifts (CLS 0). An action shows its button's `loading`. Never a full-page spinner. | `Skeleton`, `SkeletonText`, `Agenda loading` (krizaka-ui#628), `DataTable loading` |
| **Error** | In place, never a blank page. A section that failed says so with « Réessayer », and the rest keeps working. A form error sits under its field, and focus goes to the first invalid field. An unknown address answers the beaver's 404. On the phone, offline is a warning alert, and the actions that write wait. | `Alert` (`danger`, `warning`), `ErrorPage`, `Field.Error` |

The copy says what happened and what to do, in the trade's words (`console.vocabularies`), never « Une erreur est survenue ».

### 2.6 Mobile and macOS parity

- **One map.** The web's five places are also the phone's tabs and the Mac's ⌘1 to ⌘5, in the same order:
  Aujourd'hui · Clients · Factures · Livres · Boutique. The phone's « Calendar » becomes the month view of Aujourd'hui
  (the `DayStrip` opens a `MonthPicker`). Its « Settings » becomes the account under the avatar (krizaka-ui#580, #503), with
  Boutique as the fifth tab. This answers question 1 of the review with its default.
- **Same pieces, same words.** The phone uses the native twins of the web's blocks: `Agenda` and `DayStrip` (krizaka-ui#628),
  `LineItems` and `TotalsSummary` (krizaka-ui#629), `Stat` and `Alert` (krizaka-ui#275), and the organise surfaces
  (krizaka-ui#627). The words come from the same message keys; there are no locale ternaries.
- **Same addresses.** A link opens the same screen on the web, the phone and the Mac (#278).
- **The Mac stays the web app in a window** (ADR-005). It adds what a tab cannot: the menu in the Mac's language, the links, and
  later notifications. There is no point of sale and no hardware: AGENTS § 2 keeps the point of sale a stub, and restaurants
  are excluded. #79 is reshaped accordingly (§ 5).

---

## 3. Organisation: clients, requests and invoices (krizaka-ts#89)

Akinaza adopts #89 **after Yomizaka** (the pilot), with its one API. The requirements were posted on the ADR
(krizaka-ts#89, comment of 2026-10-24); the UI side is krizaka-ui#627.

| | Clients | Invoices | Requests (client side) | The agenda |
| :-- | :-- | :-- | :-- | :-- |
| **Tags with a marker** | yes: the shop's set (e.g. « Entreprise », « Soutien mensuel », « En anglais ») | yes | no | no |
| **Status** | none | **derived** from the ledger (`invoiceState`: à payer, partiel, en retard, payée, avoir, annulée), shown and filtered, never moved by hand | none today | **derived** from check-in (réservé, en cours, terminé, annulé, absent) |
| **Saved views** | Tous · Reste dû · by tag | À payer · En retard · Ce mois-ci · by tag | no | no |
| **Bulk actions** | tag · untag · export (CSV) | tag · untag · export (CSV) | no | no |

- **Tags belong to the shop.** The owner and the manager write them, and staff read them (`roles.ts`). A client never sees the
  shop's tags on their own records. The administrator sets the default tag set per trade and whether owners may create their
  own; the marker palette is closed (krizaka-ui#627).
- **Nothing that touches the ledger is a bulk action**: there is no bulk « payée », and a payment stays one recorded payment.
- **Requests have no owner side today.** `client_requests` are a client's kept requests, renewed in one tap. A status set
  « en attente · acceptée · refusée » would need the owner to review requests, which is a product decision (Q3), not a UI one.
- **The address is the state**: `?view=reste-du&tag=entreprise`, so back, forward and share work.
- **Isolation:** another shop's tag or view answers 404, like any resource (AGENTS § 5).

---

## 4. The key screens: direction A, refined (mockups)

Composed **only from published @krizaka/ui 3.53 blocks** (`RailNav`, `AppHeader`, `DashboardLayout`, `DayStrip`, `StatGrid`,
`Agenda`, `DataTable` with `selectable`, `FilterBar`, `Chip`, `DetailLayout`, `DescriptionList`, `Field`, `StickyAction`,
`EmptyState`, `Skeleton`, `Alert`, `Badge`, `Avatar`, `Mascot`), rendered by a throw-away Vite page and photographed at 1440 and
360 px, dark and light. Demo data of Éric's shop, said as demo on the screens. What does not exist yet carries a green
« à venir » badge naming its issue. The tag dot and the selection bar are stand-ins (a `Badge` with a dot, a `Card`) until
krizaka-ui#627 ships.

Base: `https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups/`

| Screen | Desktop dark | Desktop light | Phone dark | Phone light | What it decides |
| :-- | :-- | :-- | :-- | :-- | :-- |
| **Aujourd'hui** | [today](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups/today-desktop-dark.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups/today-desktop-light.png) | [phone](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups/today-phone-dark.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups/today-phone-light.png) | Closed days greyed in the strip. Three figures without a frame on a desktop and one line on a phone. « La journée facturera » instead of « Revenu attendu ». The agenda with the now line. « Facturer » on a finished appointment, « Commencer » on the next one. « À encaisser » beside the day, saying how many are due and how many are late. |
| **Clients** (list) | [clients](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups/clients-desktop-dark.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups/clients-desktop-light.png) | [phone](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups/clients-phone-dark.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups/clients-phone-light.png) | Saved views as chips with counts. Search and a tag filter. Tags as a column. « Reste dû » and « Facturé » in the owner's words. |
| **Clients, two selected** (bulk) | [bulk](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups/clients-bulk-desktop-dark.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups/clients-bulk-desktop-light.png) | [phone](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups/clients-bulk-phone-dark.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups/clients-bulk-phone-light.png) | The selection bar: the count, then tag, untag, export and cancel. Nothing else. |
| **A client** (detail) | [client](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups/client-desktop-dark.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups/client-desktop-light.png) | [phone](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups/client-phone-dark.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups/client-phone-light.png) | `DetailLayout`: the primary action « Facturer ce client », which opens a new invoice with the client chosen. Three figures. The invoices with their derived state, dates on one line. The visits. The margin: contact, invoice language, consents, a signed note, the tags. |
| **New invoice** (creation flow) | [new](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups/invoice-new-desktop-dark.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups/invoice-new-desktop-light.png) | [phone](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups/invoice-new-phone-dark.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups/invoice-new-phone-light.png) | Three numbered steps. Lines added and removed, quantities to the hundredth, an amount per line. The total in view with its GST and QST lines, and « Émettre la facture » as the one primary. The number is given at issue and never promised before it. The language and the terms are defaults, shown and changeable. |
| **The three states** | [states](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups/states-desktop-dark.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups/states-desktop-light.png) | — | — | Empty, loading and error, as § 2.5 says. The beaver renders small: that is the bug krizaka-ui#623 fixes. |

What the mockups also showed, and where it goes: at 360 px the agenda still cuts names when the avatar is shown
(krizaka-ui#628); the creation flow's `StickyAction` is covered by the tab bar (krizaka-ui#630); `DataTable`'s phone cards are tall
for a three-figure list (accepted for now, revisit with #397).

---

## 4b. The key screens: direction B, bolder (mockups)

Asked in the CTO's review of #325: the same four screens, bolder, so that Oussama chooses on pictures. They use the same rule:
**only published @krizaka/ui 3.53 blocks and the tokens**. The copper is `--kz-accent-2` through the preset's `text-accent-2` and
`border-accent-2`. The type uses the `display-lg` and `display-xl` roles. The motion is `@krizaka/ui/motion.css`. There is no
paper, no grid, no serif, no stamp and no tape.

What B does differently:

- **The copper is the second accent.** It sets the eyebrow over each `h1`, the section numbers (`01`, `02`, `03`), the rule and
  numbers of the notes column, the figure that asks for action (« à facturer », « à encaisser », the due date) and the count of
  the bulk bar. It is never a button and never a status.
- **A confident type scale.** The `h1` is a sentence that answers the screen's question, at `display-xl` on a desktop and
  `display-lg` on a phone (« Studio Lumen arrive à 14 h. », « 3 clients, 8 008,00 $ à encaisser. »). The figures are large
  and tabular. Section titles are 24 px and bold.
- **The Cahier's organising ideas, visible.** Each screen is numbered sections (`01 La journée · 02 Les rendez-vous ·
  03 À encaisser`). A **notes column** on the right, with a copper rule, carries numbered notes. They explain a figure (¹ next to
  « à facturer »), keep the owner's signed notes, and state a rule (« une action groupée ne touche jamais les factures »). On a
  phone, the numbers sit inline and the notes come last.
- **The beaver carries a meaning.** It appears only on good news that closes a loop: « aucune facture en retard » on Today, and
  « facture émise » after issuing, at 72 px, `success`. It never appears on a working list.
- **The next move leads.** On Today the primary action is the next appointment (« Commencer avec Studio Lumen », then
  « Terminer le rendez-vous »), and the header's « Nouvelle facture » becomes secondary. On the bulk bar, the suggested tag is
  the primary.
- **Motion on state changes,** from `@krizaka/ui/motion.css` as it ships. The row that changed plays `data-kz-arrive` under
  `data-kz-arrival="flash"`: an accent wash that fades, about 1 s. The control that succeeded plays `data-kz-status="success"`:
  a ring of the success colour, 0.9 s. Both use `--kz-ease`, transforms and colour only, and rest done under reduced motion.
  The **mid** frame below is the motion frozen at about 35 % of its run.

| Screen | Desktop dark | Desktop light | Phone dark | Phone light | What it says |
| :-- | :-- | :-- | :-- | :-- | :-- |
| **Aujourd'hui** | [dark](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/today-desktop-dark.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/today-desktop-light.png) | [dark](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/today-phone-dark.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/today-phone-light.png) | The headline is the next client. Three large figures, the copper one explained by note ¹. The agenda. « À encaisser » with the beaver when nothing is late. |
| **Clients, with the bulk bar** | [dark](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/clients-desktop-dark.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/clients-desktop-light.png) | [dark](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/clients-phone-dark.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/clients-phone-light.png) | « 3 clients, 8 008,00 $ à encaisser. » Views, then the list. The bar has a copper border and a copper count, and the suggested tag as its primary. |
| **A client** | [dark](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/client-desktop-dark.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/client-desktop-light.png) | [dark](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/client-phone-dark.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/client-phone-light.png) | The name at `display-xl`. 01 L'argent (the amount due in copper), 02 Les factures, 03 Les visites. Notes and « Ajouter une note » in the column. |
| **New invoice** | [dark](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/invoice-new-desktop-dark.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/invoice-new-desktop-light.png) | [dark](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/invoice-new-phone-dark.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/invoice-new-phone-light.png) | 01 Pour qui ? · 02 Quoi ? · 03 Quand ? The total at `display-md` in view. After issuing: the number, the beaver and « Envoyer à Atelier Boréal ». |

**The state changes, frame by frame** (`mockups-b/frames/`):

| Screen | The change | Desktop dark | Phone light |
| :-- | :-- | :-- | :-- |
| Aujourd'hui | « Commencer » on Studio Lumen: the row turns « En cours · depuis 14 h 02 » and washes once, the status rings, the headline becomes « Studio Lumen est avec vous. » | [before](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/frames/today-before-desktop-dark.png) · [mid](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/frames/today-mid-desktop-dark.png) · [after](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/frames/today-after-desktop-dark.png) | [before](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/frames/today-before-phone-light.png) · [mid](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/frames/today-mid-phone-light.png) · [after](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/frames/today-after-phone-light.png) |
| Clients | « Ajouter « Relance novembre » » on two clients: the bar gives way to a success alert with « Annuler », and the two rows wash once with their new copper tag | [before](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/frames/clients-before-desktop-dark.png) · [mid](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/frames/clients-mid-desktop-dark.png) · [after](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/frames/clients-after-desktop-dark.png) | [before](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/frames/clients-before-phone-light.png) · [mid](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/frames/clients-mid-phone-light.png) · [after](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/frames/clients-after-phone-light.png) |
| A client | « Garder la note »: the note arrives at the top of the column (slide in), and the button rings | [before](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/frames/client-before-desktop-dark.png) · [mid](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/frames/client-mid-desktop-dark.png) · [after](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/frames/client-after-desktop-dark.png) | [before](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/frames/client-before-phone-light.png) · [mid](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/frames/client-mid-phone-light.png) · [after](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/frames/client-after-phone-light.png) |
| New invoice | « Émettre la facture »: the number KZ-00023 and the beaver arrive, « Envoyer à Atelier Boréal » rings as the next primary | [before](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/frames/invoice-new-before-desktop-dark.png) · [mid](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/frames/invoice-new-mid-desktop-dark.png) · [after](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/frames/invoice-new-after-desktop-dark.png) | [before](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/frames/invoice-new-before-phone-light.png) · [mid](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/frames/invoice-new-mid-phone-light.png) · [after](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b/frames/invoice-new-after-phone-light.png) |

### A or B

| | A, refined | B, bolder |
| :-- | :-- | :-- |
| **What changes on screen** | Today's app, tidied: the same layouts with fixed widths, the owner's words, the three states and the organise pieces | A, plus a sentence as `h1`, large figures, copper section numbers and notes column, the beaver on two good-news moments, the next move as primary, motion on every state change |
| **Phase 2 cost** | The cut of § 7 as written (D1–D11) | The same cut, plus: a `Section`/notes-column composition in krizaka-ui (or `DetailLayout`'s aside reused), a headline string per screen and state in both languages (about 12 new message pairs per screen), the motion attributes on four screens (the primitives already ship, so krizaka-motion#57 shrinks to its documentation), and one more contrast test (copper text on surfaces 0 to 2). About two more slices: a « B frame » slice before D2, and its adoption in D2 to D5. |
| **Risk** | It reads as « the current app, tidied »: low brand presence, and « moderniser » may still be judged under-delivered | Errata 2 moves: on Today the primary becomes the next appointment, not « Nouvelle facture » (a revision of UX_DECISIONS needed). A sentence headline must stay true in every state and trade (empty day, walk-ins, a pets shop's « promenade »), so more copy to test. Copper text must keep 4.5:1 in both themes. A notes column costs width under 1 280 px. Too much motion if more than one change plays at once (rule: one wash per action). |
| **Reversible?** | yes | yes: B is A plus a composition layer; going back is removing it |

Both stay plain Krizaka UI by the 2026-10-22 decision. B brings the Cahier's organisation, not its look.

## 4c. Direction B2: the chosen direction, refined (mockups)

**Decision by Oussama (2026-10-24, on #325): direction B, with refinements.** B2 is the direction this document now
proposes; A and B stay above as the record of the choice. Same rule: published @krizaka/ui 3.53 and @krizaka/charts 0.6
blocks and the tokens only, and what a block lacks is a filed krizaka-ui issue (the list below), never a copy.

| Refinement asked | What B2 does | Blocks used · upstream issue |
| :-- | :-- | :-- |
| « Aujourd'hui » too ugly: no date strip, **the date on the right**, more information, charts and quick access; then **the home grammar of Yomizaka** (CTO, by delegation) | The headline and the next move on the left; « Semaine 43 · jeudi 22 octobre » with ‹ Calendrier › on the right. **« Le classeur » right under the heading**: the day's dividers (Rendez-vous 3 · À facturer 1 · À encaisser 3 · Cette semaine 11). **Two columns on a desktop**: the main one holds the binder's content, the appointments (01) and their notes; the side one holds 02 Accès rapide (Nouvelle facture, Facturer the done appointment, Relancer an invoice due soon, Ma page publique), 03 L'activité as **one discreet row** of three figures with sparklines and the 7 / 30 / 90 j switch (never stacked full width), and 04 À encaisser with the balance meter and the beaver when nothing is late. One column on a phone, main first | `Agenda`, `Tabs`, `Sparkline`, `Meter`, `Tabs segmented` · krizaka-ui#648, #649, #653 |
| **A ⌘K search** in the top bar; navigation revisited | The family top bar: search (« Rechercher un client, une facture… » ⌘K) opening the palette (clients, invoices, actions), the language « fr », messages, notifications with a count, the avatar **with the name**. The rail shows its labels on a desktop, badges (3 rendez-vous, 3 à payer), and a « Raccourcis » group | `AppHeader`, `CommandDialog`, `Kbd`, `RailNav` · krizaka-ui#647 |
| **Binder tab dividers** for organisation | Clients: coloured intercalaires per tag (Tous · Entreprise · Soutien mensuel · En anglais · + Intercalaire). A client's file: Résumé · Factures · Visites · Notes. The colour is the tag's marker; no paper | `Tabs` + a local top edge in the mockup · krizaka-ui#648 (and #627) |
| **Reuse**: Orochia's top bar, the org avatar set and banner, Orazaka's Studios catalogue and Credits & usage, the nicer primaries | The top bar above; the client's **profile banner** with the family avatar; Clients as the catalogue pattern (plan strip with a meter, search, filter chips with counts, rows with a status and an action « Facturer »); the usage panel on Today; the **hero primary** (brand gradient green → copper, sheen, chamfer) once per page | `Meter`, `Chip`, `DataTable`, `Button variant="gradient" shimmer` · krizaka-ui#650, #652, #598 |
| **Pages on the templates** | Today = Operate · dashboard; Clients = Operate · catalogue; a client = Show · detail; new invoice = Act · form. What each template lacks is listed in krizaka-ui#653, recorded with the #622 audit; what Orochia and Orazaka have is extracted per #515 | krizaka-ui#653, #622, #515 |
| No café or restaurant as a customer | The demo client « Studio Lumen inc. (démo) » replaces the seed's café in every mockup (A, B and B2) | the seed, D0 |

| Screen | Desktop dark | Desktop light | Phone dark | Phone light | Motion frames (state change) |
| :-- | :-- | :-- | :-- | :-- | :-- |
| **Aujourd'hui** | [dark](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/today-desktop-dark.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/today-desktop-light.png) | [dark](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/today-phone-dark.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/today-phone-light.png) | [before](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/frames/today-before-desktop-dark.png) · [mid](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/frames/today-mid-desktop-dark.png) · [after](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/frames/today-after-desktop-dark.png) · phone: [before](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/frames/today-before-phone-light.png) · [mid](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/frames/today-mid-phone-light.png) · [after](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/frames/today-after-phone-light.png) |
| **Clients, with the bulk bar** | [dark](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/clients-desktop-dark.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/clients-desktop-light.png) | [dark](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/clients-phone-dark.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/clients-phone-light.png) | [before](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/frames/clients-before-desktop-dark.png) · [mid](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/frames/clients-mid-desktop-dark.png) · [after](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/frames/clients-after-desktop-dark.png) · phone: [before](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/frames/clients-before-phone-light.png) · [mid](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/frames/clients-mid-phone-light.png) · [after](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/frames/clients-after-phone-light.png) |
| **A client** | [dark](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/client-desktop-dark.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/client-desktop-light.png) | [dark](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/client-phone-dark.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/client-phone-light.png) | [before](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/frames/client-before-desktop-dark.png) · [mid](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/frames/client-mid-desktop-dark.png) · [after](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/frames/client-after-desktop-dark.png) · phone: [before](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/frames/client-before-phone-light.png) · [mid](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/frames/client-mid-phone-light.png) · [after](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/frames/client-after-phone-light.png) |
| **New invoice** | [dark](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/invoice-new-desktop-dark.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/invoice-new-desktop-light.png) | [dark](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/invoice-new-phone-dark.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/invoice-new-phone-light.png) | [before](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/frames/invoice-new-before-desktop-dark.png) · [mid](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/frames/invoice-new-mid-desktop-dark.png) · [after](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/frames/invoice-new-after-desktop-dark.png) · phone: [before](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/frames/invoice-new-before-phone-light.png) · [mid](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/frames/invoice-new-mid-phone-light.png) · [after](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/frames/invoice-new-after-phone-light.png) |
| **⌘K search** (open) | [desktop dark](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/today-search-desktop-dark.png) | — | — | [phone light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/324/mockups-b2/today-search-phone-light.png) | — |

The state changes are those of § 4b, on the B2 frame: « Commencer » on Today, the bulk tag on Clients, « Garder la note » on a
client, « Émettre la facture ». Their motion is `@krizaka/ui/motion.css` as it ships (`data-kz-arrive` with
`data-kz-arrival="flash"`, `data-kz-status="success"`).

**What the mockups showed** and the issues carry: `KpiStat` prints « CA$10,295.70 » and « vs previous period » on a French page
without a provider (krizaka-ui#649); the phone's tab bar covers a StickyAction (#630); the activity stays a compact strip; a full chart belongs to Livres › Rapports (#219), not to Today. Messages and notifications are the family's slots: Akinaza
shows a count only for what it really sends (new bookings, invoices viewed, through krizaka-ts#60 when it lands), and the messages
slot renders only once Akinaza has conversations.

## 5. What we stop or change (anti-rework)

| Issue | Today | Decision |
| :-- | :-- | :-- |
| **#323** K7 polish | Folds the request form and merges the Loi 25 cards | **Keep, widen slightly**: the invoices in the client space become rows with their derived state and amount (not ten raw links), and « Effacer » moves into « Mes données », away from the download. One primary per screen. Lands as D7. |
| **#317** studio | Boutique › Page with a live preview; the cahier doc also puts a « Le mot du jour » card on Aujourd'hui | **Change one point**: no card on Aujourd'hui (Today is the day, not the page). « Le mot du jour » becomes a secondary action in Today's header, opening a sheet: still one tap, without a block. The rest of #317 stands. |
| **#79** macOS « countertop & POS » | Cash drawer, ESC/POS printers, tips, real-time revenue terminal | **Stop that scope.** The Mac app exists (apps/desktop, ADR-005: the web app in a window). Reshape #79 to the menu order of § 2.6 and to notifications. The point of sale stays a stub behind `APP_POS_ENABLED` (AGENTS § 2). |
| **#75** « smart dropzone & auto-processing » | Intelligent extraction of receipts | **Stop as written**: it breaks « no AI in the product, its screens or its words ». What may live is « Ajouter une dépense » with a receipt attached and the figures typed by the owner, in Livres. Any extraction goes through Orazaka behind a port, after reopening #161. |
| **#219** Reports | A Reports page | **Change the place**: a section of **Livres** (« Rapports »), never a sixth place on the rail. |
| **#80** compliance calendar | A business fiche and calendar | **Same rule**: a section of Livres if it is built, never a new place. |
| **#104** ShopSetup wizard | A multi-step onboarding wizard | **Stop the wizard UI**: K4 made Boutique a hub of sections with one save each. Keep only the code split of `ShopSetup.tsx` (a refactor), with no new screen. |
| **#78** storefront themes | Visual customisation and themes | **Close as folded** into #261 (templates) and #305 (papers). |
| **#168** phone app | Today, bookings, quick invoice, clients, notifications | **Re-scope the tabs** to the web's five (§ 2.6); Calendar moves into Aujourd'hui; the quick invoice uses `LineItems` native (krizaka-ui#629). Lands as D8. |
| **#183**, **#181** | Today as a timeline, clients as files, account blocks | Mostly shipped (K1, K2, K6). **Close after D4 and D5**, which carry what remains. |
| **K3 / K3b** of the review (invoices, clients) | Never filed | **Filed after « validé »** as D2, D3 and D5 of this cut, on the blocks above. |
| The phone app's own `AppHeader` (`apps/mobile/src/ui`) | A local header | Stays until krizaka-ui#580 lands, then it goes. |

Nothing here changes the storefront's Cahier plan (#304 → #318). The direction only places its line (§ 2.2) and proposes Q2 and Q5.

---

## 6. Upstream needs

**Filed for this direction:**

| Repository | Issue | For |
| :-- | :-- | :-- |
| krizaka-ui | [#626](https://github.com/krizaka/krizaka-ui/issues/626) the product register at brand level (fonts) | § 2.4, finding 12 |
| krizaka-ui | [#627](https://github.com/krizaka/krizaka-ui/issues/627) the surfaces of krizaka-ts#89 (marker palette, TagChip, StatusChip, saved views, selection bar) | § 3 |
| krizaka-ui | [#628](https://github.com/krizaka/krizaka-ui/issues/628) agenda: phone layout, loading rows, native Agenda + DayStrip | Today, § 2.6 |
| krizaka-ui | [#629](https://github.com/krizaka/krizaka-ui/issues/629) form `LineItems` + `TotalsSummary` (web + native) | New invoice |
| krizaka-ui | [#630](https://github.com/krizaka/krizaka-ui/issues/630) rail-nav task mode: the tab bar yields to a StickyAction | New invoice on a phone |
| krizaka-ui | [#631](https://github.com/krizaka/krizaka-ui/issues/631) StatGrid inline, Widget plain, the all-zero day | Today |
| krizaka-ui | [#647](https://github.com/krizaka/krizaka-ui/issues/647) the family top bar (⌘K, language, messages, notifications, name), RailNav shortcuts | B2 |
| krizaka-ui | [#648](https://github.com/krizaka/krizaka-ui/issues/648) Tabs `binder` dividers | B2, § 3 |
| krizaka-ui | [#649](https://github.com/krizaka/krizaka-ui/issues/649) UsagePanel from Orazaka's Credits & usage; charts' French defaults | B2 Today |
| krizaka-ui | [#650](https://github.com/krizaka/krizaka-ui/issues/650) ProfileBanner from Orochia | B2 client |
| krizaka-ui | [#652](https://github.com/krizaka/krizaka-ui/issues/652) the hero primary | B2 |
| krizaka-ui | [#653](https://github.com/krizaka/krizaka-ui/issues/653) the templates Operate, Show and Act gain what B2 needs (with #622; extraction per #515, both commented) | B2 |
| krizaka-motion | [#57](https://github.com/krizaka/krizaka-motion/issues/57) the product register | § 2.3 |
| krizaka-ts | [#89, comment](https://github.com/krizaka/krizaka-ts/issues/89#issuecomment-6388320567): derived status sets, shop-scoped tags, no ledger bulk action | § 3 (a requirement on the ADR, not a new issue) |

**Already open, and needed by the cut:** krizaka-ui#595 (DataTable localised labels), #596 (Money for the locale), #593 (header
context switcher), #594 (media manager), #588 (header primary at 360 px), #589 (labelled theme row), #590 (default marks for
places), #608 (StickyAction `hideWhileVisible`), #623 (EmptyState mascot at 120 px), #580 (native account button), #503 (native
account settings), #275 (native Stat and Alert), #286 / #287 (Mac context menu and split view, later).

---

## 7. The Phase 2 cut (in order; filed only after « validé »)

Each item is one pull request, test-first, with before/after captures at 360 and 1440 px in both themes, as Éric. Each one waits for
the bricks it names.

| # | Slice | Scope | Needs |
| :-- | :-- | :-- | :-- |
| D0 | **Demo data without a café** | Rename the Krizaka persona's client « Café du Parc inc. (démo) » to a service business (« Studio Lumen inc. (démo) ») in `seed-krizaka.ts`, the QA account names and the captures; a test that no demo client or shop name is a café, restaurant, bar or bakery | none |
| D1 | **Type register** | Adopt the brand-level font switch; `h1` at 700; tabular digits on every amount | krizaka-ui#626 |
| D1b | **The B2 frame** | The family top bar (⌘K search and palette over clients, invoices and actions; language; notifications; the avatar with the name), the rail with labels, badges and shortcuts, the hero primary; one primary per screen, and on Aujourd'hui the next appointment (UX_DECISIONS updated) | krizaka-ui#647, #652 |
| D2 | **Factures: the list and an invoice** (K3) | French chrome, fixed columns (the number narrow, the client wide, no « Mois »), the derived state as a chip with tone, overdue first; the invoice on `DetailLayout` (the number as `h1`, the state chip, « Envoyer la facture » as primary, « Modifier » and « Imprimer » secondary, an aside with deliveries and the chain) | krizaka-ui#595 |
| D3 | **Nouvelle facture** | `LineItems` + `TotalsSummary`, numbered steps, the total in view, `StickyAction` in task mode, fr-CA money; prefilled from « Facturer ce client » and from a finished appointment (`?client=&service=&quantity=`) | krizaka-ui#629, #630, #596 |
| D4 | **Aujourd'hui (B2)** | On the Operate · dashboard template: the headline and the next move, the date on the right (no date strip), « Le classeur » under the heading, two columns (main: the appointments and notes; side: quick access, the activity strip with the 7/30/90 switch and sparklines, « À encaisser » with the balance meter), one column on a phone; the all-zero day as its empty state; « Le mot du jour » as a header action when #317 lands | krizaka-ui#649, #653, #628, #631, #623 |
| D5 | **Clients and a client** (K3b, B2) | Clients on the catalogue template (plan strip, search, filter chips with counts, rows with a state and « Facturer »); the file on Show · detail with the profile banner, the binder sections and the notes column; dates on one line, the invoices' derived states | krizaka-ui#650, #653, #628 (binder dividers wait for #648 and D10) |
| D6 | **States sweep** | `loading.tsx` per owner route in the page's boxes (CLS test), the beaver's empty states at 120 px, errors in place with « Réessayer », Boutique's `h1` (« Boutique ») with the section as `h2` | krizaka-ui#623 |
| D7 | **Client space** (#323, widened) | Requests folded, invoices as rows with their state, one « Mes données » | none |
| D8 | **Phone app parity** (#168) | The five tabs, Calendar into Aujourd'hui, the agenda and day strip native, the quick invoice on `LineItems` native, the three states, no locale ternary; simulator captures as Éric | krizaka-ui#628, #629, #275, #580 |
| D9 | **Mac menu** (#79 reshaped) | ⌘1–⌘5 in the rail's order and words | none |
| D10 | **Organise** | Tags on clients and invoices, saved views on Clients and Factures, the binder dividers per tag, bulk tag/untag/export; the admin's default tag set per trade | krizaka-ts#89 « validé » and its Yomizaka pilot, krizaka-ui#627, #648 |
| D11 | **Product motion** | The realtime row wash on Aujourd'hui and Factures; insert and remove | krizaka-motion#57 |

---

## 8. Questions only Oussama can decide

1. **Q1. One map on every device**: the web's five places as the phone's tabs, with Calendar folded into Aujourd'hui and Settings
   under the avatar? *Default: yes.*
2. **Q2. The visit report wears the shop's thin paper head**, like the booking journey? *Default: yes; the public invoice stays a
   plain document.*
3. **Q3. Do requests get an owner side** (the owner reviews a client's request: en attente · acceptée · refusée)? *Default: not
   now; requests stay the client's kept requests, and no status set is added for them.*
4. **Q4. The shop by its slug in the app's addresses** (`/app/krizaka-demo/aujourdhui`) instead of its id, with the old addresses
   redirected (#278)? *Default: yes.*
5. **Q5. On the shop's public page, the shop leads**: Akinaza's product bar shrinks to a small « Réserver avec Akinaza » mark, and
   the shop's sign takes the top (with #306)? *Default: yes; the public pages keep one quiet way back to Akinaza.*

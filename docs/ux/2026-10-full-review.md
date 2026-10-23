# Akinaza — full UX review and target design (October 2026)

Status: **proposal, phase 1 (docs only)** — the CTO validates before any implementation. Oussama (2026-10-23): the app is
« trop moche actuellement »; he wants a complete review, not patches, with Orazaka's web client as the reference for
app quality (« le menu, la navigation, la gestion du profil utilisateur, des icônes par défaut »).

This document is the evidence for the Dev preview criterion `ux.ia-review` (gap in `dev-preview.json`, issue #27) and
frames the work in flight: #261 (storefront templates, validated), #267 / PR #281 (default media), #265 / #266 (the
shop editor in sections, merged), #260 (explained figures), #198 (account baseline), #277 (the phone app). Nothing here
is implemented; section 5 is the cut.

Captures (never committed) are on Bunny under `pr-assets/akinaza/ux-review-2026-10/` — every screen, signed out and
signed in, desktop (1440 px) and phone (390 px), dark and light, personal data masked. Two accounts were used (§ 1).
The index is in the appendix; the links below point into it.

---

## 0. The verdict in five lines

1. **The frame does not say where you are.** The sidebar lists seven words (Aujourd'hui · Clients · Factures · Vos
   livres · Équipe · Ma page boutique · Profil), « Profil » is also « Réglages » in the account menu, the header says
   « Votre boutique » on every page (so every page has two `h1`), the shop's name appears nowhere in the frame, and the
   account shows the raw e-mail because the owner has no name.
2. **Today is a wall of cards, not a day.** For a pets shop the owner gets the walker's view: each walk a 700 px card
   (every dog, every owner's phone, « Voir les notes d'accès » three times, a full-width primary, the report form
   inline), the Monday brief *above* the day, no figures, no « now » line — the agenda `docs/UX_DECISIONS.md` decided
   is not what the owner sees. 2 099 px for two walks.
3. **Invoices speak English and carry settings.** The table's chrome reads « Search numéro », « Search client »,
   « 12 rows », « Columns », « Export CSV » (the `DataTable` defaults, never translated); a « Paramètres par défaut des
   courriels de facture » form with its own full-width primary sits under the list; the money field says « $CA0,00 »;
   the invoice page has no title, a lone « Modifier » floating top-right and « Envoyer » above the document.
4. **The shop editor asks a salon owner to type `adresse | description (fr) | description (en) | légende (fr) |
   légende (en)` in a textarea** to manage the gallery; the « Apparence » list offers eleven sections, five of them
   « en préparation », with unnamed arrow buttons (11 unnamed controls); the storefront of the salon demo wears
   notebooks and meeting rooms (the consulting set) and an Orazaka photo as its cover.
5. **The public site is the best part** (the real app in a phone frame, three real stills, no empty band), but the
   sign-in never shows « Mot de passe oublié ? » although the page exists, the generic 404 is Next's default while the
   shop 404 wears the beaver, and **every app and storefront page throws React #418** (a hydration mismatch on text)
   — a flash and a re-render on each load.

Every target screen below is composed from blocks that exist in @krizaka/ui 3.51 (`rail-nav`, `app-header`,
`account-menu`, `page-header`, `detail-layout`, `settings-layout`, `account-settings`, `dashboard-layout`, `agenda`,
`stat`, `filter-bar`, `data-table`, `date-picker`, `split-view`, `sticky-action`, `empty-state`, `error-page`). Four
pieces go to krizaka-ui (§ 5.2), two of them shared with Yomizaka's review.

---

## 1. Scope and method

| | |
| :-- | :-- |
| Site | https://www.akinaza.com (dev.akinaza.com and app.akinaza.com redirect there), build `v0.1.0+887224d`, @krizaka/ui 3.50 |
| Accounts | **`APP_QA_AKINAZA_ADMIN_*`** — an ADMIN account that works in no shop: it lands on the *client space* (« Mes réservations », empty). **`APP_QA_AKINAZA_WALKER_*`** — the **owner** of the demo shop « Pattes de Saint-Henri » (business type *pets*, role Propriétaire): the whole owner app. Keys read by name, values never printed. |
| Viewports | desktop 1440 × 900, phone 390 × 844 (2×), plus a 360 × 780 overflow check without pictures |
| Themes | dark and light, through `kz-theme` |
| Tooling | Playwright (Chromium, headless), one browser at a time; a MutationObserver masks e-mails, phones, postal codes, tax numbers, street numbers and — in the owner app — every dollar amount; `audit.json` and `audit-walker.json` record per page the title, the `h1`s, landmarks, unnamed buttons, unlabelled inputs, overflow and console errors |
| Screens | 13 public pages (home FR/EN, sign-in, sign-up, forgot password, privacy, three storefronts, a service, the booking entry, two 404s) signed out and four of them signed in; the home's and the storefront's first screen at both widths; the client space (3); the owner app (19: today FR/EN, clients, a client file, invoices, an invoice, its correction, a new invoice, books, team, the editor's seven tabs, languages, add a shop, profile, security); the drawer, the account menu, keyboard focus, a wrong password — 190 pictures |

**Not reached, and why**

- `admin.akinaza.com` — gated by `AUTH_ALLOWED_IPS`; out of scope (the console has its own `admin.ux-review`).
- The **owner's agenda for a *professional* shop** (`TodayDay`: the day strip, the three figures, the agenda rows, the
  side sheet) — the owner account at hand runs a *pets* shop, which renders `WalkerDay` instead. The salon and the
  studio demos have owners (`demo-shops.ts`) but no QA credentials in `@qa`. Findings on Today are about what a pets
  owner sees; the agenda was read in code and in `docs/UX_DECISIONS.md`.
- The booking journey past the service page (`/s/<slug>/service/<id>/creneau`, the confirmation) — it needs an
  account and a real slot; `/s/<slug>/book` redirects to sign-in. The public invoice (`/invoice/<token>`), the report
  (`/report/<token>`) and the brief stop page need tokens.
- `/en/s/ferland-conseil` answers **« Not found · Introuvable »**: the consulting demo has not enabled English (#258), so
  its English address does not exist — correct, but a visitor who switches language on a storefront lands on a 404.
- Loading and running states were read in the code, not captured.

---

## 2. The reference: what Orazaka's web client does

Read in `krizaka/orazaka-web-client` (`src/app/(protected)/layout.tsx`, `components/layout/Sidebar.tsx`,
`Header.tsx`, `features/profile/*`, `docs/ux/information-architecture.md` of the Orazaka workspace):

```
rail (RailNav, desktop) / bottom tabs (phone):   mark · Home · Studios · Chat · Jobs · Packs · Usage  ───  Settings · (Admin)
header (AppHeader):   [mark on phone] Orazaka  [Local · Sovereign chip]            theme · bell · [avatar ▾]
account menu (AccountMenu):   avatar · name · e-mail  │ Profile · Settings │ Language ▸ │ Sign out
settings (SettingsLayout, one route per section):  Account · Appearance · Workspace · Integrations · API keys · Webhooks
home:  a greeting, one primary action (« New chat »), the figures, the recent work — skeletons while it loads
```

Pictures of the reference, signed out (`pr-assets/yomizaka/ux-review-2026-10-reference-orazaka/`):
[the home's first screen](https://krizaka-assets.b-cdn.net/pr-assets/yomizaka/ux-review-2026-10-reference-orazaka/signed-out/home-en-desktop-dark-first.png),
[the sign-in](https://krizaka-assets.b-cdn.net/pr-assets/yomizaka/ux-review-2026-10-reference-orazaka/signed-out/login-desktop-dark.png).

The rules Akinaza will follow too:

1. **Where you work on the rail, who you are under the avatar** — nothing in both (today: Profil in both).
2. **One list** of sections, read by the rail, the drawer and the phone's tabs; the active one from the route.
3. **The header names the product and the context** (for Akinaza: the shop); the page's `h1` is in the content.
4. **Settings are routes** on `SettingsLayout`, flat rows, one save per section (the shop's settings included).
5. **Every state is told**: skeletons, empty states with the bird, errors as alerts in place.

---

## 3. Findings, ranked by impact on the owner

Impact: **A** blocks or misleads the job · **B** slows it or looks unfinished · **C** polish. Evidence names a picture
of the appendix; `signed-in-walker/` is the owner, `signed-in/` the client space.

### A. Shell, navigation, wayfinding

| # | Impact | Finding | Evidence | Target |
| :-- | :-- | :-- | :-- | :-- |
| A1 | A | **Seven sidebar items, two of them the same place.** Aujourd'hui · Clients · Factures · Vos livres · Équipe · Ma page boutique · **Profil**, and the account menu's only link is **« Réglages »** → the same `/app/profile`. The family's rule and the Dev preview criterion say about five, and never a place in both. | [today](#captures), [account-menu-open](#captures) | five destinations on a `RailNav`; the account under the avatar only (§ 4.1) |
| A2 | A | **Every page has two `h1`** (the audit counts 2 on all 19 owner pages): the `AppShell.Header` title « Votre boutique » is a heading, and the page adds its own (« Vos clients », « Factures »…). The header's words never change; the shop's name is nowhere in the frame — it appears only inside Today. | audit-walker.json `h1=2`, [clients](#captures) | `AppHeader name="Akinaza"` + the shop as a context chip/switcher; one `PageHeader` per page |
| A3 | B | **No primary action in the frame**: « Nouvelle facture » exists on the invoices page only; Today has none; the editor's « Ajouter une boutique » is a link in a lead. | [today](#captures), [invoices](#captures) | the header carries « Nouvelle facture » (`shape="cut"`) on every screen |
| A4 | B | **The header's account shows a truncated e-mail** (no name on the owner account) — the same `showName` fallback as Yomizaka's; the profile has no name field and no picture choice. | [today](#captures), [profile](#captures) | `showName` only with a name; name + `AvatarPicker` in the account (PR #198 + `account-settings`) |
| A5 | B | **The shop switcher is a native `<select>`** at the top of the sidebar, drawn only when the account works in two shops; a one-shop owner has no sign of which shop the frame is about. | code `ShopSwitcher`, [today](#captures) | the shop's name in the header, a `DropdownMenu` when there are several (krizaka-ui K6) |
| A6 | B | **React #418 (hydration mismatch, text) on every signed-in page, the storefronts and the privacy page** — Today, Clients, Invoices, Books, Team, Profile, `/s/<slug>`, `/privacy`: the server and the browser disagree on a text (dates and times formatted in two time zones or two locales, the same class of defect `docs/UX_DECISIONS.md` § 10 fixed in Yomizaka's console). React re-renders the page after a flash and drops the server markup's event handlers until then. | audit-walker.json `errors`, every page | one rendering: dates formatted with the shop's time zone and the page's locale on both sides; the crawl fails on a console error |
| A7 | C | The DEV build line sits at the sidebar's foot (fine) and the theme row of the account menu is a lone moon icon with no visible label. | [account-menu-open](#captures) | a labelled « Thème » row (K3) |
| A8 | C | The drawer on a phone is right: the same list, a close button, the version. | [phone-menu-open](#captures) | kept, as the rail's tabs |

### B. Today

| # | Impact | Finding | Evidence | Target |
| :-- | :-- | :-- | :-- | :-- |
| B1 | A | **The owner of a pets shop gets the walker's cards, not the agenda.** Each walk is a card of 700 px: the time in mono, every dog with breed and size, every owner's name **and phone**, a note, « Voir les notes d'accès » three times, a full-width primary « Commencer la promenade »; the finished walk shows the report form inline (note, a photo drop zone, two buttons) and « Commencée à 23 h 14 · Terminée à 23 h 14 · 1 min ». No figures, no « now » line, no next client. | [today](#captures), [today-phone](#captures) | the agenda of UX_DECISIONS for every trade: three `Stat`s, `Agenda` rows (time · client · service · who · status word · one quiet action), the « now » line; the walk's dogs, phones, access notes, start/finish and the report in the side sheet (`Dialog placement="right"`); the walker's card view stays for staff on a phone |
| B2 | A | **« Le point du lundi » comes before the day** — an empty brief (« Rien à signaler cette semaine ») is the first thing on the owner's screen every morning. | [today](#captures) | a dismissible banner under the page header when it has something to say; its own route `/brief` for the full view |
| B3 | B | **Day navigation is two secondary buttons** (« ← Jour précédent », « Jour suivant → ») with no way back to today and no date; the day strip and « Aujourd'hui » of `TodayDay` are absent here. | [today](#captures) | the day strip + `DatePicker`, « Aujourd'hui » |
| B4 | B | **« Dernières factures » repeats what Factures shows**, at the very bottom, after 1 800 px of walks. | [today](#captures) | kept as a `DashboardLayout` widget beside the agenda on a desktop (two columns), under it on a phone |
| B5 | C | « promenades : 2 » as the page's lead; the shop's name as the `h1`. | [today](#captures) | `PageHeader` « Aujourd'hui » · the date; the shop's name in the header (A2) |

### C. Clients

| # | Impact | Finding | Evidence | Target |
| :-- | :-- | :-- | :-- | :-- |
| C1 | B | The list is right (a `DataTable`: who, visits, last, next, spent) but has no search or filter, and no empty state for a shop without clients beyond a sentence. | [clients](#captures) | `FilterBar` (search by name, « vus ce mois »), `EmptyState` with the beaver |
| C2 | B | The client file (`SplitView`, good) lists visits as « Promenade en groupe 60 min » wrapped on three lines in a narrow column, the money in a 2xl mono `Stat`; « Voir les notes d'accès » is a full-width ghost button at the end. | [client](#captures) | column `priority` (date · service · status on a phone), a plain `Stat`, the notes as a `<details>` |
| C3 | C | The four figures of the file (« Visites · Total dépensé · Dernière visite · Prochaine visite ») print dates in the figure's large mono. | [client](#captures) | `Stat` for the two numbers, `DescriptionList` for the two dates |

### D. Invoices

| # | Impact | Finding | Evidence | Target |
| :-- | :-- | :-- | :-- | :-- |
| D1 | A | **English in the French UI**: « Search numéro », « Search client », « 12 rows », « Columns », « Export CSV » — `DataTable`'s default labels, `labels` never passed (the clients and books tables avoid it because they have no toolbar). | [invoices](#captures) | the `labels` of `DataTable` from the messages (and K8: a localised default) |
| D2 | A | **Settings on a list page**: « Paramètres par défaut des courriels de facture » (message, sender, copy, link duration) with a full-width primary « Enregistrer les paramètres » under the list — two primaries on one page, and a setting nobody looks for under a list. | [invoices](#captures) | Boutique › Factures (a `SettingsSection` with one save) |
| D3 | A | **The invoice page has no title**: a lone « Modifier » floats top-right outside the card, « Envoyer la facture » (secondary) sits above the document, the back link is *inside* the document card, « Cette facture n'a pas encore été envoyée. » hangs under it. | [invoice](#captures) | `DetailLayout`: back · « F-00012 » · state chip · issued/due · client · actions (« Envoyer » P, « Modifier », « Imprimer ») · the document · the delivery history aside |
| D4 | B | **The money field prints « $CA0,00 »** (new invoice) and « $CA22,00 » (correction): the `Money` field formats CAD the English way in a French page. | [invoice-new](#captures), [invoice-correct](#captures) | « 0,00 $ » in fr-CA (K9) |
| D5 | B | **The new invoice is three fixed « Service n » selects** plus an « Autre ligne »; no total, no taxes shown before « Émettre »; « Quantité de l'autre ligne » as a label. | [invoice-new](#captures) | lines added one by one (« Ajouter une ligne », as the correction form already does), a live total (sous-total · TPS · TVQ · total) in a side panel, `StickyAction` on a phone |
| D6 | C | The chevron column (row expander) has no accessible name (1 unnamed button). | audit-walker.json | the `DataTable` expander label from the messages |

### E. Books

| # | Impact | Finding | Evidence | Target |
| :-- | :-- | :-- | :-- | :-- |
| E1 | C | **The best page**: title, period, quarter chips, two `Stat`s, the FPZ-500 lines with « 9 documents derrière ce chiffre », the honest footnote. The figures still speak the form's language (« TPS (ligne 109) ») and nothing says what to do next. | [books](#captures) | #260: `KpiExplained` (meaning · formula · source · freshness) and « Que faire maintenant » once krizaka-ui#558 ships; a « PDF pour le comptable » action in the `PageHeader` |

### F. Team

| # | Impact | Finding | Evidence | Target |
| :-- | :-- | :-- | :-- | :-- |
| F1 | B | **Dates typed as text** (« Du » / « Au » with placeholders `2026-12-20`) in the time-off form while `@krizaka/ui` has a `DatePicker`; three unlabelled inputs on the page. | [team](#captures) | `DatePicker` (a range), labels |
| F2 | B | **Three stacked forms of different widths** (members table full width, the invitation at 40 %, the time-off card full width), two primaries, « Depuis 17 oct. 2026 » wrapped on three lines in a narrow column. | [team](#captures) | Boutique › Équipe on `SettingsLayout`: members (table with a « Retirer » confirm), « Inviter » as a dialog from one button, time off as one section with one save |

### G. The shop page editor and the storefront

| # | Impact | Finding | Evidence | Target |
| :-- | :-- | :-- | :-- | :-- |
| G1 | A | **The gallery is a textarea of `adresse \| description (fr) \| description (en) \| légende (fr) \| légende (en)` lines**, under two drop zones and an « Adresse de la photo de couverture » URL field. A salon owner cannot use this. | [shop-editor-media](#captures) | a media manager: the pictures as a grid (`MediaGrid`), each with its alt FR/EN, order and « Retirer »; upload adds to it; the URL field only as « Ajouter par adresse » in a dialog (K7) |
| G2 | A | **The demo salon wears the wrong trade**: the cover is an Orazaka gallery picture (`site/products/orazaka/gallery/…`), the service cards and « Images du métier » show notebooks, a meeting room and books (the *consulting* set). PR #281 says the salon's borrowed cover is gone and the salon has its trade — the deployed site still shows the old data. | [shop-salon](#captures), [shop-editor-media](#captures) | the demo seed sets `shop_type` for the three demos and clears the borrowed cover (PR #281's migration, verified live) |
| G3 | B | **« Apparence » lists eleven sections, five « en préparation »**, all checked, with up/down arrows that have no accessible name (11 unnamed buttons); the logo drop zone has a second « Téléverser le logo » button outside it. | [shop-editor-look](#captures) | only live sections in the list (the prepared ones appear when their feature lands), named arrows (« Monter Services »), one upload control |
| G4 | B | **Seven tabs in a row** (Identité · Votre page · Contact et lieu · Ce que vous offrez · Photos et vidéo · Apparence · Publier) scroll sideways on a phone; the header's lead, the public link and « Ajouter une boutique » repeat on every tab. | [shop-editor](#captures), [shop-editor phone](#captures) | `SettingsLayout` grouped (sections on the side, one menu on a phone), the status and the public link in its identity header |
| G5 | B | **« Langues de votre page » is one column of 3 900 px**: the languages card, an alert, then every text as source + textarea + hint, services not grouped, no visible save per block. | [shop-languages](#captures) | a source → translation table grouped by section (Accroche · Histoire · Services), a state chip per row, « Traduire automatiquement » as the one primary when available |
| G6 | B | The storefront is the plain Krizaka UI page (CoverHero, services grid, team, hours, « Qui vous accueille », gallery, CtaPanel, a sticky « Réserver » on a phone): correct, readable, but not yet the **Cahier** look Oussama decided for the public shop pages; the team shows « Camille » twice; the cover's status chip reads « Ouvert maintenant · ferme à 19 h » on a page that hydrates with #418. | [shop-salon](#captures), [shop-salon phone first screen](#captures) | #261 phase 2 (templates, validated), #267 defaults by trade, A6 |
| G7 | C | The service page is good (« Avec qui ? » chips, what is included, the price with its taxes, one primary « Voir les heures »). | [shop-service](#captures) | kept |

### H. Account and the client space

| # | Impact | Finding | Evidence | Target |
| :-- | :-- | :-- | :-- | :-- |
| H1 | B | **The profile is three read-only rows** (courriel, langue, rôle) on `SettingsLayout` — right frame, no content: no name, no picture, no « member since », no preferences; PR #198 brings the five sections. | [profile](#captures) | PR #198 + `AccountProfileCard` + `AvatarPicker` + name (so the header shows a name) |
| H2 | B | **A client's space says « Votre boutique » and « Ma page boutique »** (sidebar: Mes réservations · Ma page boutique · Profil) although the person runs no shop; its empty state is the beaver at 36 px in a dashed box. | [account-home](#captures), [account-home phone](#captures) | « Mes réservations » as the frame's name; « Ouvrir une boutique » as an action, not a place; `EmptyState` with the beaver at 120 px |

### I. The public site (akinaza.com), signed out and signed in

| # | Impact | Finding | Evidence | Target |
| :-- | :-- | :-- | :-- | :-- |
| I1 | A | **« Mot de passe oublié ? » is never shown**: the page `/forgot-password` exists and works, the message `signIn.forgot` exists, the sign-in form does not render it. | [sign-in](#captures), [forgot-password](#captures) | the link under the password field |
| I2 | B | **The generic 404 is Next's default** (black, English) while the shop 404 is branded (« 404 », the beaver, FR/EN): `not-found.tsx` lives under `[locale]`, unmatched routes never reach it. | [not-found](#captures), [shop-not-found](#captures) | `ErrorPage` at the root, the shop page's look |
| I3 | B | **The sign-in's left half is empty** — one sentence, a 72 px beaver, 900 px of dark (the same `AuthLayout` use as Yomizaka); the phone form is fine. | [sign-in](#captures) | the beaver large, three promises (« au cent près », « Loi 25 », « vos clients réservent seuls ») |
| I4 | B | **Signed in, the bar says « Ouvrir l'app »** beside the avatar while the hero still invites to « Parler d'Akinaza avec nous »; Yomizaka's bar says « Open the app ». | [public-home signed in](#captures) | the hero's action follows the session (« Ouvrir l'application » P, « Parler d'Akinaza » S); one wording across the family |
| I5 | C | **The home is the right model**: the real app in a phone frame beside the promise, three real stills as features, the trust line; no empty band, the product inside the first screen on a phone. The stills are cropped mid-screen (« Facture / Invoice » cut). | [home first screen](#captures), [home phone first screen](#captures) | kept; the stills cropped at a clean edge; proofs under the hero (« x réservations », « au cent près ») when the figures exist |
| I6 | C | « La boutique de démonstration » in the bar leads to one shop; a visitor switching the language on a storefront whose shop did not enable it lands on the shop 404 (`/en/s/ferland-conseil`). | [shop-conseil-en](#captures) | the language switch of a storefront offers only the shop's languages |

### J. Accessibility (WCAG 2.2 AA, 360 px)

| # | Impact | Finding | Target |
| :-- | :-- | :-- | :-- |
| J1 | A | Two `h1` on every owner page (A2); 11 unnamed buttons on « Apparence » (G3), 1 on invoices (D6), 1 on « Publier »; unlabelled inputs on team (3), media (2), today (1), invoices (1), look (1), publish (1). | A2, G3, D6, F1 |
| J2 | B | No horizontal overflow at 360 px on any page (the 360 pass is clean on both accounts) — good; the editor's tabs scroll inside their strip. | — |
| J3 | B | Focus: the ring is visible on the sidebar items and the skip link exists (`AppShell`). | — |
| J4 | C | Light theme: consistent everywhere captured; the storefront's cover scrim keeps the text readable in both. | — |

### K. Copy (FR/EN)

- D1's English chrome is the only English in the French UI; `krizaka-i18n check` cannot see it because the words are the
  block's defaults, not messages.
- « Vos livres » for the tax return page (the owner's word is « taxes »), « Ce que vous offrez », « Votre page boutique »
  are good; « Quantité de l'autre ligne », « Adresse de la photo de couverture » and the pipe format are not.
- « promenades : 2 », « 1 de 5 chiens », « Commencée à 23 h 14 · Terminée à 23 h 14 · 1 min » — demo artefacts the seed
  should not produce (a walk that lasted a minute at 23 h).

### L. Consistency

- With **Orazaka**: a sidebar of words (`AppShell`) where the family's apps use the rail; the account in the sidebar
  *and* the menu; the header names nothing; settings for the shop scattered (invoices page, editor tabs, team page,
  languages page) instead of one `SettingsLayout`.
- With **Yomizaka**: the same `AuthLayout` emptiness, the same e-mail fallback, the same Next 404, the same lone moon
  icon — four shared fixes (K2–K4 of Yomizaka's review, I2, I3).
- Between **Akinaza's own screens**: the invoices table has a toolbar in English, the clients table none; Today's walk
  cards vs the agenda the decisions describe; two 404s.

---

## 4. The target design

### 4.1 Information architecture

**Who comes:** the owner (a walker, a hairdresser, a coach, a cleaner, a consultant), their staff on a phone, their
clients on the storefront. **The owner's jobs:** see the day and what it pays; take the next booking in; invoice and get
paid; know the taxes to set aside; keep the page and the team right.

```
rail (RailNav, expandable, words shown; phone: bottom tabs)     header (AppHeader)
┌────┐
│ 🦫 │ mark → /app                                               [≡ phone][🦫] Akinaza  [Pattes de Saint-Henri ▾]  [DEV]
│ ◷  │ Aujourd'hui   /app/<shop>/aujourdhui                                                   [Nouvelle facture ▸ P, shape=cut]  [avatar ▾]
│ 👥 │ Clients       /app/<shop>/clients                                                                            ├ avatar · name · e-mail
│ 🧾 │ Factures      /app/<shop>/invoices                                                                           ├ Mon compte      /app/profile
│ 📒 │ Livres        /app/<shop>/books                                                                              ├ Langue ▸ · Thème ▸
│ 🏪 │ Boutique      /app/<shop>/boutique   (SettingsLayout, grouped)                                               ├ (Administration — admins)
│    │                 Page: Identité · Votre page · Contact et lieu · Offre · Photos et vidéo · Apparence · Publier  └ Se déconnecter
│ ‹  │                 Équipe · Langues · Factures (courriels) · Boutiques (changer, ajouter)
└────┘
phone tabs:  Aujourd'hui · Clients · Factures · Livres · Boutique   (the same five as the rail; the account in the header, as today)
staff (role Employé, phone):  Aujourd'hui (their walks, the card view) · Clients · Boutique › Équipe (their time off)
client (no shop):  Mes réservations · Mon compte  — « Ouvrir une boutique » as an action on the page
```

- **Five destinations**, read by the rail, the drawer, the tabs. « Profil » leaves the rail; the account lives under
  the avatar (Orazaka's rule). « Équipe », « Ma page boutique », the languages and the invoice e-mails become sections
  of **Boutique** — one place for everything that configures the shop, on `SettingsLayout` grouped (one menu on a
  phone, never a strip of seven tabs).
- **The shop in the header**: its name as a chip; a `DropdownMenu` with the other shops and « Ajouter une boutique »
  when the account has several (K6). The header names the product; the page's `h1` is in the content (`PageHeader`).
- **One primary action**: « Nouvelle facture », on every owner screen, in the header.
- **Addresses kept** (`/app/<shop>/…` of `lib/routes.ts`); new: `/app/<shop>/boutique/<section>` with 308s from
  `/shop`, `/shop?tab=`, `/shop/languages`, `/team`; `/brief` for the Monday brief.
- The phone app (PR #277) today has Today · Calendar · Invoices · Clients · Settings: aligning the two lists is question 1.

### 4.2 Wireframes

Blocks named in brackets. « P » = primary, « S » = secondary.

#### Today (`/app/<shop>/aujourdhui`) — the owner, any trade

```
desktop                                                                          phone (390)
┌─rail─┬──────────────────────────────────────────────────────────────────┐     ┌────────────────────────────┐
│ 🦫   │ Akinaza · Pattes de Saint-Henri ▾ · DEV   [Nouvelle facture P] [👤▾] │     │ 🦫 Akinaza · Pattes… [+][👤]│ [AppHeader]
│ ◷    ├──────────────────────────────────────────────────────────────────┤     ├────────────────────────────┤
│ 👥   │ Aujourd'hui · vendredi 23 octobre              [‹] [23 oct ▾] [›]  │     │ Aujourd'hui · ven. 23 oct. │ [PageHeader + day strip,
│ 🧾   │ ▸ Le point du lundi : 3 créneaux libres cette semaine · Inviter →  │     │ [‹ 22][23][24 ›] Aujourd'hui│  DatePicker]
│ 📒   ├──────────────────────────────┬───────────────────────────────────┤     │ ▸ Le point du lundi        │ [Alert, dismissible]
│ 🏪   │ 2 rendez-vous   •••,•• $      │ Prochain client                   │     ├────────────────────────────┤
│      │ TPS et TVQ incluses           │ 14 h · Promenade en groupe        │     │ 2 rdv · •••,•• $ · 14 h    │ [Stat ×3, DashboardLayout]
│      ├──────────────────────────────┴───────────────────────────────────┤     ├────────────────────────────┤
│      │ 14 h 00  Promenade en groupe 60 min · 5 chiens · Léa   Réservée  [Commencer] │ │ 14 h 00 Promenade en groupe│ [Agenda rows: time,
│      │ ───────────────────── maintenant · 14 h 32 ─────────────────────── │     │   5 chiens · Léa · Réservée│  title, who, status word,
│      │ 15 h 00  Promenade en groupe 60 min · 1 chien · Léa    Terminée  [Rapport →] │ │ ── maintenant · 14 h 32 ── │  one quiet action]
│      ├──────────────────────────────┬───────────────────────────────────┤     │ 15 h 00 … Terminée [Rapport]│
│      │ Dernières factures           │ (a row opens the side sheet →)    │     ├────────────────────────────┤
│      │ F-00012 Nadia Benali À payer │                                   │     │ Dernières factures         │ [Card widget]
│ ‹    │ Toutes les factures →        │                                   │     └────────────────────────────┘
└──────┴──────────────────────────────┴───────────────────────────────────┘
side sheet (Dialog placement="right", phone: full screen): the walk — the dogs (breed · size · note), each owner with « Appeler »,
« Notes d'accès » folded, [Commencer la promenade P] or the report (note, photo, [Envoyer à Camille P] [Enregistrer S]), the times.
empty day: 🦫 (beaver « empty ») « Rien de réservé » + « Vos clients réservent depuis votre page » + [Voir ma page S].
```

#### Invoices (`/app/<shop>/invoices`) and an invoice

```
┌──────────────────────────────────────────────────────────────────┐
│ Factures                                                         │ [PageHeader — the primary is the header's]
│ [Numéro ou client…] [État ▾] [Mois ▾]   12 factures   [⋯ Colonnes · Exporter CSV] │ [FilterBar + DataTable, labels in FR]
│ Numéro   Client          État     Émise      Échéance   Total  Reste dû │
│ F-00012  Nadia Benali    À payer  24 sept.   —          •••    •••   ▸  │
│ …                                                                 │
└──────────────────────────────────────────────────────────────────┘
invoice (DetailLayout):
┌──────────────────────────────────────────────────────────────────┐
│ ← Factures                                                       │
│ F-00012  [À payer]  émise le 24 sept. 2026 · Nadia Benali    [Envoyer la facture P] [Modifier S] [Imprimer S] │
│ ┌ the document (InvoiceDocument) ─────────────┐ ┌ Envois ───────────┐ │
│ │ Facture / Invoice … sous-total · TPS · TVQ   │ │ Pas encore envoyée│ │ [aside: delivery history,
│ └──────────────────────────────────────────────┘ │ Remplace F-00009  │ │  the chain]
└──────────────────────────────────────────────────────────────────┘
new invoice: client (Combobox) · lines (service ▾ · qté · prix, « Ajouter une ligne ») · live total aside (sous-total · TPS 5 % · TVQ 9,975 % · total)
· [Émettre la facture P]; phone: the total and the action in a StickyAction.
```

#### Boutique (`/app/<shop>/boutique/page`)

```
desktop                                                               phone
┌──────────────────────────────────────────────────────────────┐   ┌──────────────────────────────┐
│ Boutique                                                     │   │ Boutique                     │ [SettingsLayout grouped]
│ 🏪 Pattes de Saint-Henri · Publiée · akinaza.com/fr/s/pattes… │   │ 🏪 Pattes… · Publiée · lien  │  identity header
│ Page        │ Identité                                       │   │ [Page ▾ : Identité]          │  (one menu on a phone)
│  Identité   │ Nom · Type d'entreprise · Raison sociale ·     │   ├──────────────────────────────┤
│  Votre page │ Votre prénom · Adresse de la page              │   │ Nom            [Pattes de…]  │ [SettingsSection, one save]
│  Contact    │ ──────────────────────── [Enregistrer P] saved ✓│   │ Type           [Soins aux…▾] │
│  Offre      │                                                │   │ …   [Enregistrer P]          │
│  Photos     │ (Photos: MediaGrid — each picture with its alt │   └──────────────────────────────┘
│  Apparence  │  FR/EN, order, Retirer; « Ajouter » = upload; │
│  Publier    │  « Images proposées » first when none)         │
│ Équipe      │ (Apparence: live sections only, named arrows,  │
│ Langues     │  the logo once)                                │
│ Factures    │ (Langues: table source → traduction, by section)│
│ Boutiques   │ (Factures: the e-mail defaults, one save)      │
└──────────────────────────────────────────────────────────────┘
```

#### Account (`/app/profile`)

```
Mon compte  [AccountProfileCard: picture · name · e-mail ✓ · member since]   sections: Profil · Préférences · Sécurité · Abonnement · Mes données (PR #198)
Profil: Nom · Photo (AvatarPicker) · Langue (LanguagePicker) — one save.  Sécurité: mot de passe · appareils.  (SettingsLayout flat)
```

#### Sign-in and 404

```
AuthLayout: 🦫 (beaver « welcome », 160) · « Votre boutique, pour moins cher — Loi 25 dès la conception. » · ✓ Chaque facture au cent près
· ✓ Vos clients réservent seuls · ✓ Vos taxes prêtes, jamais produites à votre place   │  Se connecter · courriel · mot de passe ·
« Mot de passe oublié ? » · [Se connecter P shimmer] · (sign-up from the setting) · privacy line.
404 (every address): the shop 404's look (« 404 », the beaver, FR/EN by the address) on `ErrorPage`, « Retour à Akinaza ».
```

#### Public home — kept, two touches

```
first screen (desktop): bar · « Vos rendez-vous, vos factures et vos taxes, réglés. » · lead · [Parler d'Akinaza P] (signed in: [Ouvrir l'application P] [Parler… S])
· the phone take in its frame (kept) · proofs row when real figures exist.  Phone: title · lead · action · the frame inside 844 px (kept).
features: the three real stills, cropped at a clean edge · trust line · footer.  Storefront: #261 templates (phase 2), #267 defaults by trade.
```

### 4.3 Visual direction

- **Hue**: Akinaza's forest green with copper (`.brand-akinaza`), the beaver's. The owner app stays **pro plain
  Krizaka UI** (decision 2026-10-22); the Cahier is for the public shop pages only (#261). Status by tone + word:
  `success` (fait, payée), `warning` (en cours, en retard), `neutral` (réservé, à payer), `danger` (annulée, absent).
- **Density**: comfortable in the owner app (rows 48 px on a desktop, 56 px targets on a phone; one column up to
  48 rem for forms, full width for lists); the agenda is the one dense surface (time column 64 px, rows 56 px).
- **Typography roles**: display for the one `h1` of a page (2xl, 700); section `h2` lg; card titles base 600; body
  md; figures in tabular digits (`Stat`), mono only for invoice numbers and the API.
- **Marks and icons**: `AkinazaLogo` once per width; `@krizaka/icons` for the five destinations (clock, people,
  receipt, book, shop) and the states; the shop's logo in the header chip when it has one.
- **Illustration**: the beaver only, one per screen, in its moods — `welcome` (sign-in), `empty` (an empty day, no
  clients, no invoices), `thinking` (a search without result), `success` (the tax figures ready), the 404. Sizes 160 on
  an auth page, 120 on an empty page, 72 inline; never 36 px in a dashed box. Default media per trade (#267) for the
  storefront; the org media library (krizaka-com#381) for the empty-state art when it exists.
- **Dark and light** first-class; the chamfer (`shape="cut"`) on every call to action.

### 4.4 What changes, screen by screen

| Screen | Today | Target |
| :-- | :-- | :-- |
| Shell | `AppShell` sidebar of 7 words, header « Votre boutique », Profil twice, e-mail in the trigger | `RailNav` with 5 destinations; `AppHeader`: Akinaza · shop chip/switcher · DEV · « Nouvelle facture » · avatar menu; one `h1` per page |
| Aujourd'hui | the walker's cards, the brief first, two day buttons, invoices at the bottom | agenda for every trade (stats, rows, now line, side sheet), the brief as a banner, day strip + date picker, the invoices widget beside |
| Clients · a client | table without search; file with wide dates and a notes button | FilterBar + table; file with priority columns, Stat for numbers, notes folded |
| Factures · a facture · nouvelle | English chrome, settings under the list, title-less detail, « $CA0,00 », three fixed selects | FR labels, settings moved, `DetailLayout`, fr-CA money, dynamic lines + live total + sticky action |
| Livres | good | KpiExplained + next actions (#260), PDF export |
| Équipe · Langues · Ma page boutique · Courriels | three pages and seven tabs | one Boutique hub on `SettingsLayout` grouped; media manager; live sections only; languages as a table |
| Compte | three read-only rows | PR #198 + identity card + name + avatar picker |
| Client space | « Votre boutique », « Ma page boutique », a 36 px beaver | « Mes réservations », an action to open a shop, the beaver large |
| Sign-in · 404 | no forgot link, empty aside, Next 404 | the link, the beaver and three promises, `ErrorPage` |
| Home · storefront | good · plain | session-aware hero action; the Cahier templates (#261) and trade defaults (#267) |

---

## 5. The implementation cut

One pull request each, in this order; every one ships its tests (vitest for logic, a render test for the screen, a
360 px overflow test where a layout changes, the console crawl without React errors) and its before/after captures on
Bunny (this review's pictures are the « before »).

| # | Issue (title) | Scope | Acceptance | Screens |
| :-- | :-- | :-- | :-- | :-- |
| K0 | **fix: one rendering for the server and the browser** (A6) | find the text that differs (dates/times in the shop's zone and the page's locale; `Ouvert maintenant`; the « now » line) and render it once; the live crawl fails on a console error | no React #418 on any page of the crawl (owner, client, storefront, privacy) | all |
| K1 | **shell: five destinations on the rail, the shop in the header** (A1–A5) | `RailNav` (Aujourd'hui · Clients · Factures · Livres · Boutique), `AppHeader name="Akinaza"` + shop chip (`DropdownMenu` when several, « Ajouter une boutique » inside) + DEV chip + « Nouvelle facture » P + account menu (Mon compte · Langue · Thème · Se déconnecter · Administration); Profil out of the rail; `PageHeader` with the only `h1` on every page; the client's frame « Mes réservations »; 308s for `/team`, `/shop*` | tests: the rail's five, nothing in both the rail and the menu, exactly one `h1` per page, the header's action at 360 px, the shop's name in the header, the redirects | all owner screens, client space |
| K2 | **today: the agenda for every trade** (B1–B5) | `DashboardLayout`: `PageHeader` + day strip + `DatePicker`, three `Stat`s, `Agenda` rows with the now line, the side sheet with the walk's detail and the report, the brief as a dismissible banner (+ `/brief`), the invoices widget; `WalkerDay` kept for the Employé role on a phone | tests: a pets owner renders the agenda, a staff member the cards; the sheet opens from the address; the brief banner only with items; the empty day | today, today-en, today phone |
| K3 | **invoices: French chrome, the detail, the form** (D1–D6) | `DataTable labels` from the messages; e-mail defaults moved to Boutique › Factures; `DetailLayout` for the invoice (actions, aside); dynamic lines + live total + fr-CA money + `StickyAction`; named expander | tests: no English default label rendered in FR, the detail's actions by state, the total equals the ledger rule on known lines, 360 px | invoices, invoice, invoice-new, invoice-correct |
| K4 | **boutique hub on SettingsLayout** (F1–F2, G3–G5, D2) | `/boutique/<section>` grouped: Page (the seven sections of #266 as sections, not tabs) · Équipe (members, invite dialog, time off with `DatePicker`, one save) · Langues (source → translation table by section) · Factures (e-mails) · Boutiques; the identity header with status and link; live sections only, named arrows, one logo control | tests: the groups and routes, one menu on a phone, the date range validation, the sections list excludes prepared ones, unnamed buttons = 0 | shop-editor-*, shop-languages, team, shop-new |
| K5 | **media manager** (G1, G2) | the gallery as a `MediaGrid` with alt FR/EN, order and remove; upload adds; « Ajouter par adresse » in a dialog; « Images proposées » first when none; the demo seed sets `shop_type` for the three demos and clears borrowed covers (verify PR #281's migration live) | tests: the manager round-trips the `shop_media` rows, the textarea format is gone, the salon demo resolves the salon set | shop-editor-media, shop-salon |
| K6 | **account** (A4, H1) | PR #198 as is, plus `AccountProfileCard`, a name field and `AvatarPicker` so the header shows a name; one place for the account (the menu) | tests of #198 + the header's name once set | profile, profile-security |
| K7 | **client space** (H2) | « Mes réservations · Mon compte », « Ouvrir une boutique » as an action, the beaver at 120 px, the booking list | tests: a client sees no « boutique » place; the empty state | account-home |
| K8 | **public: sign-in, 404, the hero's session** (I1–I4) | the « Mot de passe oublié ? » link, the aside content, `ErrorPage` at the root with the shop 404's look, the hero's action by session, « Ouvrir l'application » wording | tests: the link present, `/fr/nope` renders the beaver page in French with 404, the hero's two states | sign-in, not-found, public-home |
| K9 | **storefront** | #261 phase 2 (templates) and #267 defaults by trade — their own plans; from this review: the language switch offers the shop's languages only, « Camille » once in the team, the cover chip after K0 | their tests + I6 | shop-* |
| K10 | **books: explained figures** (#260) | `KpiExplained`, « Que faire maintenant », the lexique, PDF for the accountant — after krizaka-ui#558 | #260's tests | books |

Order rationale: K0 is a defect on every page; K1 is what Oussama named first and what every other screen sits in;
K2–K3 are the owner's daily loop; K4–K5 gather the shop's configuration; K6–K8 finish the map; K9–K10 ride their own
issues.

### 5.1 The in-flight work against the target

| Work | Fits as is | Needs |
| :-- | :-- | :-- |
| **#261 storefront templates** (doc merged, validated, option C) | yes — the public pages' look; K9 defers to it | the template picker lands in Boutique › Page › Apparence (K4's section), not in a tab |
| **#267 / PR #281 default media** | yes — the data, the manifest, « Images proposées », the trade column | the deployed salon still wears the consulting set and an Orazaka cover (G2): run the migration and verify live; the card goes under the media manager (K5) |
| **#265 / #266 shop editor in sections** (merged) | the seven sections and their one-save-each are kept | they become `SettingsLayout` sections under Boutique (K4), not a row of seven tabs; the header's repeated lead/link go to the identity header |
| **#260 explained figures** | yes (K10) | waits for krizaka-ui#558 |
| **PR #198 account baseline** | yes (K6) | add the name and the picture; the only account entry is the menu |
| **PR #277 phone app** | yes | question 1: align its five tabs with the web's five (or the reverse) before both ship |
| **#256 one product bar** (merged) | yes | the hero's action follows the session (K8), the wording « Ouvrir l'application » |

### 5.2 Ready-to-file krizaka-ui issues

Shared with Yomizaka's review (file once): **K2** `AppHeader` primary action slot that survives 360 px, **K3**
`AccountMenu` labelled theme row, **K4** `Avatar` default marks for places (shops, collections).

```
K6 — app-header: a context switcher (the shop, the workspace)
Why: Akinaza's owner can run several shops; today a native <select> at the top of the sidebar, shown only with two shops,
and a one-shop owner never sees which shop the frame is about. Orazaka's workspaces and Orochia's channels have the same need.
Ask: a `context` slot after `name` — a chip with the context's mark and name that is a DropdownMenu trigger when `options`
are given (the other contexts + an « add » action), plain text otherwise; truncated at 360 px with the full name as tooltip.
Tests: one context renders a chip, several render a menu, keyboard, 360 px.
```

```
K7 — media-grid: a media manager (upload, alt per language, order, remove)
Why: Akinaza's gallery is a textarea of pipe-separated lines (address | alt fr | alt en | caption fr | caption en); every
product that lets a person keep pictures (a shop, a profile, a collection) needs the same screen.
Ask: `MediaManager` on `media-grid` + `file-upload`: a grid of the person's media (image or clip with poster), each with its
alt/caption fields per locale, « Monter/Descendre » or drag with a keyboard path, « Retirer » (ConfirmButton), an « Ajouter »
drop zone, an optional « Ajouter par adresse » dialog; `value`/`onChange` as an ordered array; reduced motion.
Tests: order changes by keyboard, alt required per enabled locale, remove confirms, 360 px.
```

```
K8 — data-table: localised default labels
Why: Akinaza shipped « Search numéro », « 12 rows », « Columns », « Export CSV » in a French page because `labels` was not
passed; `krizaka-i18n check` cannot catch a block's defaults.
Ask: `DataTable` reads `labels` from a `locale` prop (fr/en bundled defaults) when none is given, so a product cannot
ship English chrome by omission; the same for `DataTableFilters`, `DataTableColumnsMenu`, `DataTableExport`, the expander.
Tests: a fr table renders French defaults; explicit labels still win.
```

```
K9 — form: Money formatted for the locale
Why: the Money field prints « $CA0,00 » on a French page (and would print « CA$0.00 » on an English one in Canada).
Ask: `form.Money` formats with `@krizaka/intl` for the form's `locale` (fr-CA « 22,00 $ », en-CA « $22.00 »), accepts
both separators on input, keeps integer cents as its value. Tests on both locales.
```

### 5.3 What this review does not change

The ledger, the taxes, the « prepare, never file » rule and the tenant isolation (AGENTS § 2, § 5) are untouched;
screens show the same figures differently. The storefront's look is #261's decision; this review only places its picker
and fixes what the pictures showed. No AI word enters the product (§ 2).

---

## 6. Questions only Oussama can decide

1. **One list for the web and the phone** — the web's five (Aujourd'hui · Clients · Factures · Livres · Boutique) or the
   phone app's five (Today · Calendar · Invoices · Clients · Settings, PR #277)? Default: the web's five on both; the
   phone's « Settings » becomes « Boutique » + the account under the avatar; a week view joins Aujourd'hui when it exists.
2. **The owner of a pets shop sees the agenda** (times, rows, the « now » line, the walk's details in a side sheet),
   and the walker's card view stays for staff on their phone. Default: yes — the owner's questions are the same in
   every trade (how many, how much, who's next).
3. **« Nouvelle facture » as the one primary of the whole app** (in the header, every screen) — or « Nouveau
   rendez-vous » once walk-ins can be created from Today? Default: « Nouvelle facture » now; revisit with walk-ins.

---

## Appendix — captures

Base: `https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/`. Folders: `signed-out/` (the public
site), `signed-in/` (the ADMIN account — the client space), `signed-in-walker/` (the owner of « Pattes de
Saint-Henri »). Pattern: `<folder>/<screen>-<desktop|phone>-<dark|light>.png`, `-first.png` for a first screen;
`audit.json` and `audit-walker.json` at the root.

<a id="captures"></a>

| Screen | Desktop dark | Desktop light | Phone dark | Phone light |
| :-- | :-- | :-- | :-- | :-- |
| Home (FR) | [home](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-out/home-fr-desktop-dark.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-out/home-fr-desktop-light.png) | [dark](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-out/home-fr-phone-dark.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-out/home-fr-phone-light.png) |
| Home — first screen | [home first screen](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-out/home-fr-desktop-dark-first.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-out/home-fr-desktop-light-first.png) | [home phone first screen](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-out/home-fr-phone-dark-first.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-out/home-fr-phone-light-first.png) |
| Home (EN) · signed in | [en](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-out/home-en-desktop-dark.png) · [public-home signed in](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-in/public-home-fr-desktop-dark-first.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-in/public-home-fr-desktop-light.png) | [dark](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-in/public-home-fr-phone-dark.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-in/public-home-fr-phone-light.png) |
| Sign-in · wrong password · sign-up · forgot password | [sign-in](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-out/sign-in-fr-desktop-dark.png) · [error](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-out/sign-in-error-desktop-dark.png) · [sign-up](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-out/sign-up-desktop-dark.png) · [forgot-password](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-out/forgot-password-desktop-dark.png) | same, `-light` | [sign-in phone](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-out/sign-in-fr-phone-dark.png) | same, `-phone-light` |
| Privacy · 404 · shop 404 | [privacy](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-out/privacy-desktop-dark.png) · [not-found](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-out/not-found-desktop-dark.png) · [shop-not-found](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-out/shop-not-found-desktop-dark.png) | same, `-light` | same, `-phone-dark` | same, `-phone-light` |
| Storefront — salon | [shop-salon](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-out/shop-salon-desktop-dark.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-out/shop-salon-desktop-light.png) | [shop-salon phone first screen](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-out/shop-salon-phone-dark-first.png) · [full](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-out/shop-salon-phone-dark.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-out/shop-salon-phone-light.png) |
| Storefront — studio · consulting (EN) · a service | [studio](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-out/shop-studio-desktop-dark.png) · [shop-conseil-en](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-out/shop-conseil-en-desktop-dark.png) · [shop-service](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-out/shop-service-desktop-dark.png) | same, `-light` | same, `-phone-dark` | same, `-phone-light` |
| Client space (ADMIN account) | [account-home](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-in/account-home-desktop-dark.png) · [profile](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-in/profile-desktop-dark.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-in/account-home-desktop-light.png) | [account-home phone](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-in/account-home-phone-dark.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-in/account-home-phone-light.png) |
| Owner — Aujourd'hui (FR · EN) | [today](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-in-walker/today-desktop-dark.png) · [en](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-in-walker/today-en-desktop-dark.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-in-walker/today-desktop-light.png) | [today-phone](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-in-walker/today-phone-dark.png) | [light](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-in-walker/today-phone-light.png) |
| Owner — Clients · a client | [clients](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-in-walker/clients-desktop-dark.png) · [client](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-in-walker/client-desktop-dark.png) | same, `-light` | same, `-phone-dark` | same, `-phone-light` |
| Owner — Factures · a facture · nouvelle · correction | [invoices](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-in-walker/invoices-desktop-dark.png) · [invoice](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-in-walker/invoice-desktop-dark.png) · [invoice-new](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-in-walker/invoice-new-desktop-dark.png) · [invoice-correct](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-in-walker/invoice-correct-desktop-dark.png) | same, `-light` | same, `-phone-dark` | same, `-phone-light` |
| Owner — Vos livres · Équipe | [books](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-in-walker/books-desktop-dark.png) · [team](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-in-walker/team-desktop-dark.png) | same, `-light` | same, `-phone-dark` | same, `-phone-light` |
| Owner — the editor (Identité · Votre page · Photos · Apparence · Publier) | [shop-editor](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-in-walker/shop-editor-desktop-dark.png) · [page](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-in-walker/shop-editor-page-desktop-dark.png) · [shop-editor-media](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-in-walker/shop-editor-media-desktop-dark.png) · [shop-editor-look](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-in-walker/shop-editor-look-desktop-dark.png) · [publish](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-in-walker/shop-editor-publish-desktop-dark.png) | same, `-light` | [shop-editor phone](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-in-walker/shop-editor-phone-dark.png) | same, `-phone-light` |
| Owner — Langues · Ajouter une boutique | [shop-languages](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-in-walker/shop-languages-desktop-dark.png) · [shop-new](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-in-walker/shop-new-desktop-dark.png) | same, `-light` | same, `-phone-dark` | same, `-phone-light` |
| Owner — profile · account menu · drawer · keyboard focus | [profile](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-in-walker/profile-desktop-dark.png) · [account-menu-open](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-in-walker/account-menu-open-desktop-dark.png) · [keyboard-focus](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-in-walker/keyboard-focus-desktop-dark.png) | — | — | [phone-menu-open](https://krizaka-assets.b-cdn.net/pr-assets/akinaza/ux-review-2026-10/signed-in-walker/phone-menu-open-phone-light.png) |

Audit numbers quoted in section 3 are in `audit.json` (public pages, client space) and `audit-walker.json` (the owner)
at the same base.

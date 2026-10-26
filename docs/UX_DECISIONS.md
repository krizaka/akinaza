# UX decisions — Akinaza

Each notable choice: decision · problem · principle (with source) · refused · cost · the signal that would say we are wrong.
Feedback: the pinned Discussion of the repository.

## 1. The day first: appointments beside an invoice

- **Decision**: the signed-in home is today — the appointments, and next to them an invoice with its GST and QST lines.
- **Problem**: a shop owner opens the tool between two clients; a dashboard of charts answers no question they have.
- **Principle**: match between the system and the real world (Nielsen, 1994); recognition over recall.
- **Refused**: a KPI dashboard as home.
- **Cost**: no overview of the month on the first screen.
- **Wrong if**: owners go elsewhere first thing every morning (navigation analytics, interviews of A0).

## 2. The invoice speaks its own language

- **Decision**: an invoice is drawn in its own language (French by default), whatever the page's language.
- **Problem**: a bilingual shop must hand clients a document the Charter of the French language accepts.
- **Principle**: consistency between preview and artefact — what you see is what the client gets (Shneiderman, *Designing the User Interface*).
- **Refused**: translating the invoice with the interface.
- **Cost**: an English-speaking owner sees French lines on a French invoice.
- **Wrong if**: owners ask for the preview in their own language more than for the real document — then add a toggle, never change the document.

## 3. Prepared, never filed

- **Decision**: "Prepare my tax return" shows the figures and their sources; the merchant files. Any difference between the
  assistant and the ledger is shown.
- **Problem**: trust — a tool that files for you is a tool you cannot check.
- **Principle**: keep the user in control of irreversible actions (Norman, *The Design of Everyday Things*).
- **Refused**: one-click filing; silently adopting the AI's figures.
- **Cost**: a last step outside Akinaza.
- **Wrong if**: merchants copy the figures with mistakes — then make the copy safer, still without filing.

## 4. The walker's day: one card per walk, the check-in is the biggest thing on it

- **Decision**: for a service shop the signed-in home is the day's walks, one card each (time, service, zone, the dogs with their owners), with « Start the walk » then « End the walk » as full-width buttons and the report form appearing under the dog once the walk is over.
- **Problem**: the walker is in the street with a leash in one hand and a phone in the other; they need one decision at a time, with a thumb.
- **Principle**: Fitts's law (large targets for the most frequent action); progressive disclosure — the report appears when it is relevant (Nielsen Norman Group).
- **Refused**: a table (the salon-style day) on a phone; a separate « reports » screen to go and find the walk again.
- **Cost**: a day with 12 walks is a long scroll; no map or route grouping yet.
- **Wrong if**: walkers check in after the fact (check-in times far from the booked start) — then the button is not where they need it.

## 5. The report is a note and a photo, shrunk on the phone

- **Decision**: one short note (the words the walker already uses: « Rex a bien marché, 45 min, pipi ✓ ») and one optional photo; the photo is redrawn at 1280 px before it is sent; the owner gets a mail with a private link, not an attachment.
- **Problem**: a 6 MB photo over mobile data in the street fails; a mail with a heavy attachment lands in spam; a report nobody reads is worthless.
- **Principle**: recognition over recall (the example is the placeholder); the peak-end rule — the report is the moment the owner remembers.
- **Refused**: a form with ratings, checkboxes for each bodily function; an attachment.
- **Cost**: the report needs the link to be opened; the link expires (30 days by default, the shop's rule).
- **Wrong if**: owners ask for the photo inside the mail.

## 6. Booking: sign in, then three small steps shown one at a time

- **Decision**: the shop page is public; booking asks for a sign-in, then shows only the next missing step — the file (name, phone, consents never pre-ticked), the dog, the walk (service, zone, dogs, a time from the list the shop offers).
- **Problem**: a dog owner arrives from a Facebook link on a phone and abandons a long form.
- **Principle**: progressive disclosure; error prevention — only times that are really free are offered, and the database still refuses a race.
- **Refused**: one long page with everything; a free-text date.
- **Cost**: a returning client with a file and a dog goes straight to the walk — a first-timer sees three screens.
- **Wrong if**: the funnel drops at the file step (measure once there are real users).

## 7. Door codes are written by the client and opened by the walker, once at a time

- **Decision**: the client writes how to get in (stored encrypted); it cannot be read back by them in the app; the walker opens it for one client at a time, each opening is audited.
- **Problem**: a list of door codes on a screen is a list of door codes in a screenshot, a shoulder surf, a backup.
- **Principle**: least privilege, and a deliberate act for a sensitive reveal (OWASP ASVS V8).
- **Refused**: showing the notes on the day card; letting the client re-read them.
- **Cost**: one tap more at the door; a client who mistyped must retype (the export gives them their data).
- **Wrong if**: walkers photograph the notes — then add a time-limited reveal.

## 8. The landing tells one story in five sections, and its proof is the walker’s real day

- **Decision**: the home is five sections: the promise (« Your shop, all in one place ») with the dog walker's real
  journey on dev.akinaza.com in a phone (StepShowcase: the shop's page, the booking, the walker's day, the report, the
  client's space; captions in the page), three outcomes (each card a way in, the first to the demo shop's real booking
  page), how it works in three steps with the beaver's promise from the film, trust (Loi 25 and Canada, « prepared, never
  filed », open source, not for restaurants and bars, Orazaka named once as planned, the status from dev-preview.json),
  the closing call. The bar has one « Product » menu and no version chip; the footer is @krizaka/ui's SiteFooter.
- **Problem**: the old home spoke of « independent shops » in general, in nine blocks; the first real proof (the walker's
  journey) was nowhere on it.
- **Principle**: show the product doing one real job before listing what it can do (recognition over recall; progressive
  disclosure).
- **Refused**: a hand-made invoice mock-up in the hero, stills with burned-in captions, a claim that the tax assistant
  runs on Orazaka before it does.
- **Cost**: stills until the journey's recording lands (then the same steps take its clips); the app is captured in French.
- **Signal we are wrong**: visitors who are not dog walkers think Akinaza is only for dog walkers.

## 9. A shop's page sells: cover first, real availability inline, every section from the shop's data

- **Decision**: the public page of a shop (`/{locale}/s/{slug}`) is, in this order, a cover hero (the shop's own photo or muted
  loop, its name, one line of promise, « Open now · closes at 5 pm » computed from its hours in its own time zone, its areas,
  and « Book » — held at the bottom of a phone), the services as cards (duration, capacity in the shop's own unit, price —
  « from » when it varies —, what is included, « Popular » only from real bookings), the next free times as chips (the real
  availability, each a link that opens the booking with the service, the area and the time chosen), the hours in one
  « Hours » row that unfolds into the week with today marked, a map of the areas served, who you will meet and the rules as
  clean rows, a look inside (the shop's photos and clips), the way in. Every section appears only when the shop has what it
  shows: a salon has no map, a new shop no gallery, no rating is shown because there is no review data.
- **Problem**: the page was a green block, four dark cards, chips, and a raw monospace table: nothing said « this is a good
  place », nothing showed when to come, and the way to book started from scratch.
- **Principle**: recognition over recall (the free times are on the page, not behind a form); the address is the state
  (`?service=&zone=#reserver`, `/book?service=&zone=&start=`, back-button safe); honest defaults (no invented rating, no
  fake « popular »).
- **Refused**: a gallery of stock photos presented as the shop's, a rating without reviews, a map that needs a third-party
  key (the basemap is Krizaka's Protomaps tiles, read through this origin), page-local components (the blocks —
  ServiceCard, SlotPicker, OpeningHours, CoverHero, StickyAction, MediaGallery — are in @krizaka/ui).
- **Cost**: the shop must add its words, places and photos (the owner's setup page does not edit them yet: the seed and the
  API do); a service chosen on the page needs the visitor to sign in before the booking, and comes back to it with the choice.
- **Signal we are wrong**: visitors who open a shop page still tap « Book » without looking at the times; owners without photos.

## Invoices for a services business (krizaka-first-client)

- **Decision**: « Invoices » sits in the shop's menu, between Clients and Your books. One form issues an invoice from the
  shop's own services (their bilingual name, price and tax category are the defaults; a negotiated price overrides) plus one
  free line; the issued ones are a list, each opening as a document in the language of the invoice, with the supplier's
  GST/QST numbers a buyer needs.
- **Problem**: a business that sells hours (development, design, consulting) had no way to issue an invoice from the app at
  all — invoices existed only in seeds — and the books had nothing of its own to prepare a return from.
- **Principle**: recognition over recall (the services are chosen, not typed) and the cost of an error (the taxes are
  computed on the server once, on the taxable total, so the screen never shows a figure the ledger will not hold).
- **Refused**: a « send to Revenu Québec »
  button (Akinaza prepares, the merchant files), a PDF engine of our own for now (the document prints from the browser).
- **Cost**: three service lines and one free line per invoice; a quantity goes to the hundredth (7,5 h billed since krizaka/akinaza#111).
- **Signal we are wrong**: owners who issue two invoices for one job because the form has too few lines.

## The words of the business (krizaka/akinaza#117)

- **Decision**: a shop has a *business type* (« Type of business » on the shop page: professional services, or pet care).
  The type sets the words of every screen of the owner and of the clients of that shop (`console.vocabularies.<type>` in
  the messages: only what differs from the base) and two behaviours: a pet-care shop books for a dog and reports on the
  visit; any other business books the client for themselves and has no report.
- **Problem**: the model is vertical-neutral, the words were the dog walker's: a software studio read « Today's walks »,
  « Dogs per walk » and a zone « Saint-Henri », and was asked for its client's dog before an appointment.
- **Principle**: match between the system and the real world (Nielsen, 1994): the owner and their clients read their own
  trade's words.
- **Refused**: guessing the words from the shop's name or its first services; a hidden setting (a closed set is a picker);
  forking the screens per vertical (one set of screens, two vocabularies).
- **Cost**: each new vertical adds its overlay in both languages; a test fails when a screen of a non-pet shop still carries
  a dog word that is not overridden.
- **Signal we are wrong**: owners who set the wrong type, or ask for a third (groomers, repairers) that fits neither.

## Payment terms and the due date (krizaka/akinaza#113)

- **Decision**: every invoice carries the terms it was issued under (« Net 30 days ») and the due date they give, in the
  language of the invoice. The shop sets its default terms once (the rules card of the shop page; 30 days, 0 = on receipt); one
  invoice can pick others from a short list. A credit note, and an invoice issued before this existed, carry none.
- **Problem**: a buyer needs the payment terms from $500 to claim its input tax credits (DORS/91-45, art. 3); Yomizaka's
  `qc-invoice` flagged our own invoice (rule 008).
- **Principle**: defaults that are right most of the time and visible (Nielsen: visibility of system status): the picker says
  what the default is.
- **Refused**: inventing terms on invoices already issued; making the owner type a date (the date follows from the terms and
  the issue date, and the database refuses a due date that does not).
- **Cost**: a custom date that is not « issue date + n days » cannot be expressed; use the nearest terms.
- **Signal we are wrong**: owners who issue an invoice, then ask for another to change its due date.

## Fractional hours (krizaka/akinaza#111)

- **Decision**: a quantity on an invoice line can be fractional to the hundredth (7,5 h, 0,25 day); it is typed with a point or a
  comma and shown the way the invoice's language writes it. The amount is `round(quantity × price)` half away from zero in whole
  cents; the GST and the QST are still computed once on the taxable total.
- **Problem**: a studio or a consultant bills 7.5 hours; whole hours only meant rounding the client's bill by hand.
- **Principle**: match the real world (Nielsen): people bill the time they worked.
- **Refused**: a unit label on the line (the service already says « hourly » or « flat fee »); a quantity finer than a hundredth.
- **Cost**: a line's cent is rounded before the invoice's taxes, so a very long list of fractional lines can differ by a cent from the exact total — the invoice shows the rounded lines, and its taxes are exact on their sum.
- **Signal we are wrong**: owners who ask to bill by the minute.

## Today is a timeline, Clients are files (krizaka/krizaka-ui#515)

- **Decision**: Today is the owner's day as an agenda: times in a column, one row per appointment (client, service, who
  does it, a status in words), a « now » line between the ones past and the ones to come, one quiet action per row (Start,
  then Finish), a strip of days above and three figures (appointments, what the day will bill with the GST and QST, the next
  client). A row opens a side sheet with the detail. The day and the open appointment are in the address. Clients are a table
  (visits, last and next visit, total spent) whose names open a file at `/app/clients/<id>`: figures, visits, invoices,
  notes, with the clients beside it on a computer.
- **Problem**: the old Today was a plain table beside an invoice preview: the owner could not see what was next, nor how
  the day would pay, and a client was a card with a phone number.
- **Principle**: recognition over recall (Nielsen) and a visible system status: the « now » line says where the day is
  without a clock; the figures answer the three questions an owner asks in the morning.
- **Refused**: a calendar grid (a salon of one to four chairs reads a list faster, and it is one column on a phone); the
  invoice preview on Today (invoices have their own page); a full-width action button on every row.
- **Cost**: no week view yet; « expected revenue » counts booked and done appointments at their service's price.
- **Signal we are wrong**: owners who open Invoices to know what the day brings, or ask for a week.
- **Every trade (UX review 2026-10, K2, decided on #289)**: the owner and a manager read this agenda whatever the trade —
  a dog walker's owner too; a walk's row reads its service and its dogs, and the side sheet carries what the walker's card
  carried (the dogs, the owners and a way to call, the access notes folded, start and end, the report). The walker's cards
  stay for staff on their phone (`lib/day.ts` `dayView`). The day is a `DashboardLayout`: the figures, the agenda beside
  the last invoices (under it on a phone), the strip of days above; « Le point du lundi » is a banner under the heading
  only when it has something to say, and lives in full at `/brief` — it never comes before the day.

## The shop page belongs to its owner

- **Decision**: the owner chooses the order and visibility of the shop page's sections and uploads its logo; global
  administrator switches remain authoritative for sections that are still being prepared.
- **Problem**: a fixed public page cannot reflect what each shop wants clients to notice first.
- **Principle**: user control and freedom (Nielsen): make the page configurable without changing its facts or booking rules.
- **Refused**: arbitrary page building, or letting owner preferences override global safety and rollout switches.
- **Cost**: new sections can be enabled administratively before they are ready to accept shop content.
- **Signal we are wrong**: owners cannot express their priorities with the available sections, or visitors cannot find services.

## Invoice quick access on Today (krizaka/akinaza#218)

- **Decision**: below the day, members allowed to invoice see a compact card with the three latest invoices, their totals
  and states, and the count of overdue invoices across the shop. Each opens its document; « All invoices » opens the list.
  An empty shop sees no card. The same card serves the agenda and the walker's day.
- **Problem**: checking the latest invoices and late payments required leaving Today.
- **Principle**: recognition over recall and visibility of system status (Nielsen): the list's payment states use the shop's
  current calendar day, even when the agenda is showing another day.
- **Refused**: duplicating search, filters or payment actions on Today; showing financial data to staff without invoice access.
- **Cost**: older invoices require opening the list; the overdue count includes invoices outside the three shown.
- **Signal we are wrong**: members mistake the latest three for all overdue invoices.

## Proposed images: no empty section, never a fake shop (krizaka/akinaza#267)

- **Decision**: each trade (salon, coaching, workshop, cleaning, pets, consulting) has neutral default media — a cover with
  its silent loop, four photos, three service images — shown on the public page only where the owner has none, and offered
  in « Images proposées » of the « Photos and video » tab, one click to adopt one; a switch turns them off per shop, the
  administrator chooses which trades are offered. The card says they are neutral pictures, not the shop.
- **Problem**: a new shop's page opened on a blank hero and an empty photos section; owners without photos left it that way.
- **Principle**: aesthetic and minimalist design with an honest default (Nielsen): the page reads finished on day one, and
  nothing on it pretends to be the owner's place — no person, no text, no storefront a client could take for the real one.
- **Refused**: replacing an owner's own media, ever; stock photos of staff or clients; a generated « shop » exterior;
  defaults for the logo (the shop name stands) or the team (the avatars already have their own).
- **Cost**: two shops of the same trade can open on the same cover until each owner uploads; a generated set per trade,
  rendered and uploaded by hand (`scripts/default-media/`), with its alt texts to write in both languages.
- **Signal we are wrong**: owners keep the defaults for months, or clients ask whether the photos are of the shop.

## A template is picked, then the page stays the owner's (krizaka/akinaza#261, step 4)

- **Decision**: « Modèle de page » sits inside « Apparence » / « Look », above the sections: the trade's templates as tiles
  with a tiny preview (the hero, the sections in the template's order, its hue and paper), the applied one marked « Your
  template », the administrator's default « Suggested » and chosen when none is applied. Applying replaces the section order
  with the template's — unless the owner reordered or hid sections by hand: then two buttons ask « keep my order » or « use
  its order », never a silent replacement. At shop creation the trade is asked (it stands for the business type) and its
  default template is preselected beside « Plain page »; it applies only because the owner keeps it chosen.
- **Problem**: a finished page suited to the trade should be one choice away, without a page builder and without losing
  what an owner already arranged.
- **Principle**: recognition over recall and user control (Nielsen): see the shape before choosing; nothing the owner wrote,
  uploaded or ordered changes behind their back.
- **Refused**: a second tab for templates; mixing templates; a template that carries texts or photos; applying the
  administrator's default to an existing shop; a full page render inside the picker (the preview is a schema, the real page is
  one click away).
- **Cost**: the preview is schematic; a template chosen at creation can only be undone from « Look »; the trade replaces the
  coarser business type question only when templates are offered.
- **Signal we are wrong**: owners open the public page to see what a tile means, or lose track of which template they are on.

## A template improves by version; the owner updates when they choose (krizaka/akinaza#261, step 5)

- **Decision**: a template that improves ships as a new version beside the old one; a shop keeps the version it applied, and
  its page does not move. In « Apparence » the applied tile says « Update available », with what changes in one line and an
  « Update to version N » action — the same « keep my order » question when the owner arranged the sections by hand.
  Switching templates, like updating, changes only the order, the variants and the hue: texts, photos, services and
  translations are untouched.
- **Problem**: improving a template must never redraw a page its owner considers done, nor lose what they wrote.
- **Principle**: visibility of system status and user control (Nielsen): the change is announced, previewed, and taken only
  by the owner's hand.
- **Refused**: silent upgrades; a template that carries content; removing an old version while a shop still uses it.
- **Cost**: the catalogue grows with every version; an owner may stay on an old look for a long time.
- **Signal we are wrong**: most shops never update, or ask why their page looks older than the demo.

## The hero follows the session, the 404 is ours (krizaka/akinaza#285, #299)

- **Decision**: the hero's action is the session's: signed out « Try the demo shop » with « Sign in » beside it; signed in « Open my shop » into the owner's app. The public bar shows the account menu alone when signed in (no second « Open the app »), never an e-mail. « Talk to us » leaves the public pages; contact lives in the footer. An unknown address answers a branded 404 in the language of its address (`global-not-found`), and the sign-in offers « Forgot your password? ».
- **Problem**: a signed-in owner was pitched to a stranger (« Talk to us »), the bar repeated « Open the app » beside the avatar, the sign-in never showed the reset link, and an unknown address got Next's default 404.
- **Principle**: the app first, never a sales call (krizaka-ui#505); one way in per state.
- **Refused**: a client-side swap of the action (it would flash the signed-out one); a second « Open the app » in the bar.
- **Cost**: the home is rendered per request (it reads the session); the 404 reads the language from the address through a header the proxy sets.
- **Signal we are wrong**: signed-in owners do not use the hero's « Open my shop », or the demo shop's visitors leave at the hero.
## The frame: where you work on the rail, who you are under the avatar (UX review 2026-10, K1)

The signed-in space is the family's frame (`RailNav` + `AppHeader` of @krizaka/ui, `components/app/ShopFrame.tsx`): a rail of
**five destinations at most** — Aujourd'hui · Clients · Factures · Livres · Boutique for the owner, what the role may open for the
others (`lib/app-nav.ts`), the bookings alone for a client — icons on a desktop, the tab bar on a phone. The header names the
product and **the shop** (a chip; a menu with the other shops and « Ajouter une boutique » when there are several or one may be
added), carries the DEV chip and **the app's one primary action, « Nouvelle facture »** (icon alone under 640 px, never absent),
and the account menu (Mon compte · Langue · Thème · Se déconnecter). The account is never on the rail, and the frame renders no
`h1`: every page has exactly one, through `PageHeader` — the crawl (`scripts/check-hydration.mjs`) refuses a page with another
count, or that scrolls sideways down to 360 px. « Équipe », the languages and the invoice e-mails join « Boutique » as sections of
its hub (K4); until then « Boutique » opens the page editor (or the team, for who may only see it) and the editor links the team.
Decided in docs/ux/2026-10-full-review.md § 4.1 (validated on #289); the administration keeps `AppFrame`.

## Boutique: one hub for what configures the shop (UX review 2026-10, K4)

« Ma page boutique », the languages, the team and the invoice e-mails are sections of **Boutique**, one hub on `SettingsLayout`
(`components/boutique/BoutiqueHub.tsx`, `lib/boutique.ts`): the shop's name, its status and its public address on top, then the
sections grouped — « Votre page » (the seven sections of the page, one save each, and the languages) and « Votre activité » (the
team, the invoice e-mails, the shops). Each section is its own address (`/app/<shop>/boutique/<section>`, the page's section in
`?tab=`); the navigation shows only what the role may open, from `packages/db/src/roles.ts` (`BOUTIQUE_NEEDS`): an owner sees all
of it, a manager the team, a staff member no Boutique at all. The seven sections are no longer a row of tabs. The invoice e-mail
defaults leave the invoices list for the hub (the list keeps the default message it sends with). Old addresses (`/shop`,
`/shop/languages`, `/team`) answer 308 to their section. « Nouvelle facture » yields on the hub and on an invoice's own screens
(detail, correction, new): those keep their own primary action (one primary per screen).

## The client space: « Mes réservations », opening a shop as an action (UX review 2026-10, K7)

Someone who works in no shop (a client) gets the same frame around **their own** records: the rail has one place, « Mes
réservations » (`CLIENT_PLACES`), and the account stays under the avatar like everyone's (« Mon compte » is never in both, K1). No
« boutique » place and no « Votre boutique » words: « Ouvrir une boutique » is a secondary action of the page header, leading to
`/app/open-shop` (the « Ajouter une boutique » form in a client's words; the shop starts unpublished). The page lists, per shop the
client deals with, the bookings (upcoming, past, the reports), the invoices (at the account's own address `/app/invoices/<id>`),
the requests and the Loi 25 card. One primary per screen: « Réserver chez … » of the first shop with a page; the others are
secondary. Empty, it is the `EmptyState` with the beaver (asked at 120 px; the block draws its icon slot at 24 px until krizaka-ui#623) and what will fill it. Another client's ids answer 404 on every
`/api/me/**` route (`app/api/client-isolation.integration.test.ts`), including a booking that names another file's dog (it was a
403 that confirmed the dog exists).

## The demo's client is a service business, never a café (Phase 2, D0)

The Krizaka persona's first client was « Café du Parc inc. (démo) »: a business Akinaza does not serve (a café, a restaurant, a
bar or a bakery bills through a sales recording module certified by Revenu Québec, AGENTS § 2). It is now **« Studio Lumen inc.
(démo) »**, the client of the direction's mockups (`docs/design/2026-10-direction.md`). A deployment already seeded is renamed in
place by the idempotent seed (`renameFormerClients`, `KRIZAKA_RENAMED_CLIENTS`): the same account, client file and invoices, so no
invoice number changes. `packages/db/src/demo-names.test.ts` refuses a café, restaurant, bar, bistro, brasserie or bakery (FR/EN)
among the shops and clients of every demo seed (`seed-krizaka`, `seed-walker`, `demo-shops`).

## The B2 frame: search with ⌘K, the rail's words and counts, one primary per screen (Phase 2, D1b, #328)

- **Decision**: the header is the family's top bar as @krizaka/ui ships it today (`AppHeader` + `CommandDialog` + `Kbd` +
  `LanguageSwitch`): « Rechercher un client, une facture… » with ⌘K (Ctrl+K) opens a palette over the shop's own client files and
  invoices (`/api/walker/search`, `searchShop`: the shop is the guard's, another shop's id is a 404) and the actions (« Nouvelle
  facture », the five places); Enter opens, Escape closes and gives the focus back. On a phone the search is the magnifier alone and
  the language stays in the account menu. The rail shows its words on a desktop (`defaultExpanded`) and two counts said in words:
  the day's appointments on Aujourd'hui, the invoices still to collect on Factures (`frameCounts`, the list's `invoiceState`); a
  zero draws nothing. **One primary per screen**, the hero primary (`Button variant="gradient"`): the header's « Nouvelle facture »
  on the lists; on **Aujourd'hui the next appointment** (« Prochain : Studio Lumen inc. à 10 h 00 », opening its sheet), « Nouvelle
  facture » there only when nobody comes next; an invoice's screens keep « Envoyer la facture » or their submit. `screenPrimary`
  decides, a test lists every owner route, and the crawl (`check-hydration.mjs`) refuses two `[data-primary]` on any page and none
  on the day, the lists and an invoice.
- **Problem**: no way to reach a client or an invoice without walking the lists; icons alone on a desktop rail; Today's primary was
  « Nouvelle facture » while the owner's next move is the next client.
- **Principle**: recognition over recall (Nielsen) and one obvious next step per screen.
- **Refused**: a local top bar or palette (krizaka-ui#640 and #647 extract the family's; until then Akinaza composes the released
  pieces); a notifications bell with a count before Akinaza sends anything to count (krizaka-ts#60); a messages slot without
  conversations; a « Raccourcis » group on the rail before `RailNav` has groups (krizaka-ui#647).
- **Cost**: one more query per page for the counts; the search reads at most five of each kind (the list is « see all »).
- **Signal we are wrong**: owners keep opening Clients to find one by name, or ignore the next-appointment action.

## Factures and an invoice: French chrome, fixed columns, the derived state, DetailLayout (Phase 2, D2, #329, review K3)

- **Decision**: the list speaks the screen's language to the last word: every label of @krizaka/ui's `DataTable` comes from the
  messages (`lib/table-labels.ts`, `table.*`) until krizaka-ui#595 localises them. The number column is narrow (132 px) and the
  client wide (240 px at least); the « Mois » column is gone (the issue date says it, and the state is the filter that matters);
  `density="compact"` on a desktop. The state is derived, never set: `invoiceState` (due, partial, overdue, paid, credit,
  cancelled) as a chip with its tone, and **the overdue first**, then the newest (`byUrgency`). An invoice is a `DetailLayout`:
  its **number is the `h1`**, the state chip beside it (the same `invoiceState`, now that `invoiceDetail` reads what was received),
  « **Envoyer la facture** » the one primary (its form in a dialog), « Modifier » and « Imprimer » secondary; the aside holds the
  deliveries and the chain. Money is integer cents through @krizaka/intl's `formatMoney` everywhere (`lib/format.ts`,
  `InvoiceDocument`): a float throws.
- **Problem**: a French list printed « Filter the table », « 5 rows », « Columns »; the number was as wide as the client; the
  overdue invoices were mixed with the paid ones; the invoice page had « Facture » as its title, its actions above the document
  and the send form unfolding in the page.
- **Principle**: match between the system and the real world, and recognition over recall (Nielsen): the state the owner acts
  on comes first and reads the same on the list and the page.
- **Refused**: a status the owner moves by hand (it comes from the ledger, § 3 of the direction); a local table translation in
  @krizaka/ui's place (the labels are passed through its own `labels` prop).
- **Cost**: twenty-six table messages to keep in two languages until krizaka-ui#595 lands; the list no longer sorts by issue date
  by default (overdue first), the header still sorts.
- **Signal we are wrong**: owners sort by date first every time, or look for the month filter.

## Nouvelle facture: lines added and removed, the total in view, numbered steps (Phase 2, D3, #330)

- **Decision**: the form asks in three numbered steps — **01 Pour qui ?** (a client file, or none), **02 Quoi ?** (lines added
  and removed: a service of the shop at its price, or « Autre » with its words and price; a quantity to the hundredth, typed
  with a comma or a point), **03 Quand ?** (today, under the shop's terms; the number is given at issue). The total is in view:
  beside the form from `lg` (a 20 rem aside), in a `StickyAction` above the phone's tab bar below it — and it is **the server's
  own computation** (`draftPreview` calls `invoiceTotals` of @akinaza/core: GST and QST once on the taxable total, half away from
  zero), in fr-CA or en-CA money from integer cents. The address prefills it: « Facturer ce client » on a client's file
  (`?client=`) and « Facturer ce rendez-vous » on a finished appointment's sheet (`?client=&service=&quantity=1`); a client or
  a service of another shop answers 404. Issued, the invoice opens with « Facture KZ-… émise » and the beaver (`success`), and
  « Envoyer la facture » is its primary (D2).
- **Problem**: three fixed service slots and one « other line », no total before issuing, the date and the number unsaid, and
  no way to bill the client or the appointment one was looking at.
- **Principle**: visibility of system status and error prevention (Nielsen): the owner sees what the client will pay before it
  is in the ledger, and the total cannot differ from the issued one.
- **Refused**: a local `LineItems` / `TotalsSummary` (krizaka-ui#629 brings them; the lines are the form's `FieldArray` until
  then); a client-side tax rule of its own; editing the date or the number here.
- **Cost**: the sticky action clears the tab bar by its known height (`STICKY_CLEARS_TAB_BAR`, 3.5 rem plus the safe area)
  until krizaka-ui#630 gives the rail a task mode; the submit is drawn twice (aside, sticky), one per width, and the crawl
  counts the primary in view.
- **Signal we are wrong**: owners issue then correct right away (#207), or abandon the form on a phone.

## The product register: the sans, the h1 at 700, tabular digits (Phase 2, D1)

`/app` draws in Krizaka UI's product register (direction § 2.4): the sans for everything, the system code mono only for
identifiers (invoice numbers, FPZ-500 line numbers, tax numbers, links), tabular digits on every amount and time. The faces come
from @krizaka/ui's product surface (`data-surface="product"` on the root; its `blocks.css` sets display to the sans and mono to
`ui-monospace`), until krizaka-ui#626 moves them into the brand tokens: no Young Serif, Courier Prime or Cahier pen is loaded by
`/app` (measured on Factures, an invoice, Livres and Aujourd'hui). The page `h1` is at 700 — `PageHeader` draws 900 — through one
local rule in `app/globals.css`, to remove with krizaka-ui#655. Amounts that were in the mono (the invoice's lines and totals,
Livres' lines, an appointment's price, the paid and balance of the public invoice) are in the sans with `tabular-nums`; the tables'
number columns and `Stat` are tabular in @krizaka/ui already. Guarded by `components/app/product-register.test.tsx`.

## Aujourd'hui on the home grammar: the headline, the binder, two columns (Phase 2, D4, #331)

- **Decision**: the page's `h1` is **the headline**, true to the day (`dayHeadline`): who is with you now and until when, else who
  comes next and at what time, else « Journée terminée », else « Rien de prévu » — a walk-in said as such, a dog walker's day read
  by its walks, another day counted. « Aujourd'hui » is the eyebrow; the next appointment is the one primary under it (D1b). The
  date is on the right (« Semaine 43 · vendredi 23 octobre » with ‹ ›); the strip of days is gone. **« Le classeur »** under the
  heading: Rendez-vous · À facturer · À encaisser · Cette semaine, with their counts. Two columns on a desktop — the agenda; then
  **Accès rapide** (Nouvelle facture, Facturer the oldest finished appointment no invoice names yet, Relancer the invoice to chase,
  Ma page publique), **L'activité** (one row of three figures — facturé, encaissé, rendez-vous faits — with a `Sparkline` each and
  the 7 / 30 / 90 j switch in the address, `?period=30`) and **À encaisser** (what is owed, a `Meter` of the overdue part, the
  beaver when nothing is late). One column on a phone, the agenda first. Every figure comes from the bookings, the invoices and
  the payments (`todayBoard`, integer cents, the shop's calendar days). A day whose figures are all zero shows only its empty state.
  An invoice now names the appointment it bills (`appointmentId`, refused for another shop's), so « À facturer » goes down when it
  is billed.
- **Problem**: the day opened on « Aujourd'hui » and a strip of fourteen days; the figures said nothing about money still owed;
  the last three invoices beside the agenda (#218) did not say what to do next.
- **Principle**: visibility of system status and recognition over recall (Nielsen): the first sentence is the day's state, the
  side column the next moves.
- **Refused**: a full chart on Aujourd'hui (it belongs to Livres › Rapports, #219); a sixth figure row; « Le mot du jour » as a
  card (#317 makes it a header action).
- **Cost**: the « Invoice quick access » card of #218 is replaced by « Accès rapide » and « À encaisser » (its component and test
  are removed); the binder is chips until krizaka-ui#648 ships the binder tabs; `@krizaka/ui` moves to 3.54 and `@krizaka/charts`
  0.6 joins for the sparklines.
- **Signal we are wrong**: owners still open Factures first thing in the morning, or never change the period.

## Clients on the catalogue, a client's file on Show · detail with signed notes (Phase 2, D5, #332, review K3b)

- **Decision**: Clients opens on a **plan strip** — how many clients, what they owe, a `Meter` of who is up to date — then the
  search (name, e-mail or phone, accents ignored) and the filter chips **Tous · Reste dû · À venir**, each with its count on the
  whole shop; both are in the address (`?q=&filter=`). Each row says the client's state (« Reste dû 31,74 $ » or « À jour ») and
  carries « Facturer »; selected rows can be exported (CSV) — tags and the other bulk actions wait for D10 (krizaka-ts#89). A file
  is a `DetailLayout`: the name as the `h1` with the avatar and the state, the contact and « client depuis » on one line,
  « Facturer ce client »; the binder's sections **Résumé · Factures · Visites · Notes** in the address (`?tab=`), chips until
  krizaka-ui#648; each invoice wears the list's derived state. **Signed notes** (`client_notes`, the shop's own): the words, the
  author's name and the day on one line, newest first, « Ajouter une note » in the side column (under the content on a phone);
  erasing the client (Loi 25) deletes them.
- **Problem**: a client was a row with spent and visits; nothing said who owes, the file stacked every section, and a note was one
  free text with no author or date.
- **Principle**: recognition over recall and visibility of system status (Nielsen); a note is accountable when it is signed.
- **Refused**: a profile banner drawn here (krizaka-ui#650 extracts Orochia's); tags before D10; editing or deleting a note (a
  note is kept as written; a new note corrects it).
- **Cost**: one table and its migration (`0032_client_notes`); the old single « notes » field stays read-only in Résumé.
- **Signal we are wrong**: owners keep their notes elsewhere, or ask to edit a note.

## Every owner screen tells its three states: loading, empty, error (Phase 2, D6, #333)

- **Decision**: **loading** — a `loading.tsx` on Aujourd'hui, Clients, a client, Factures, an invoice and Livres draws the page's
  own boxes (`PageSkeleton`: the day's heading, binder and two columns; a list's heading, strip, filters and rows; a file's
  header and sections), `aria-busy` and named, never a full-page spinner; the crawl refuses a layout shift of 0.01 or more on the
  day, Clients and Factures (`shiftProblem` in `check-hydration.mjs`). **Empty** — the beaver at 120 px, what will fill the
  screen and one way forward (Factures: « Nouvelle facture »; Clients; the day's agenda). **Error** — in place: a section that
  fails (`settle`) is an `Alert` with « Réessayer » (`SectionError`, the page read again) while the rest renders — Aujourd'hui
  keeps its agenda when its board fails. **Boutique** names the screen in its one `h1` (« Boutique »); each section's title is an
  `h2`.
- **Problem**: a blank screen while the data streamed, a sentence where a list was empty, a failed query blanking the whole page,
  and Boutique's section title standing as the page's `h1`.
- **Principle**: visibility of system status and help users recover from errors (Nielsen).
- **Refused**: a spinner over the page; an error's technical words on screen (`settle` keeps them in the server's log).
- **Cost**: the skeletons follow the pages' structure by hand: a page that changes its boxes changes its skeleton.
- **Signal we are wrong**: owners reload by hand after a failed section, or the crawl reports a shift.

## The client space: invoices as rows, the request form folded, one « Mes données » (Phase 2, D7, #334)

- **Decision**: each shop's **invoices are rows** (`List` of @krizaka/ui): the number, the day it was issued, its state derived
  from the ledger in the owner list's words and tone (`invoiceState`, `STATE_TONE`: Payée, En retard, À payer…) and its amount,
  the whole row opening the invoice. **The request form is folded** behind « Garder une demande » (a secondary that opens it in
  place, closed again once the request is kept), and « Reprendre » is a secondary: the screen keeps its one primary (« Réserver chez
  … » at the first shop). **« Mes données (Loi 25) » appears once, at the end**: a row per shop with its download, then
  « Effacer un dossier » in a block of its own — the danger is never beside the copy; each erasure speaks its shop's vocabulary.
- **Problem**: ten raw links (« Ouvrir la facture KZ-00022 · 310,43 $ ») with no state; an open form and a Loi 25 card per shop,
  the erase button beside the download; « Reprendre » a second primary.
- **Principle**: recognition rather than recall (the state on the row), progressive disclosure (the form on demand), error
  prevention (the irreversible action apart from the frequent one).
- **Refused**: a `DataTable` here (a client reads three to ten invoices, no filter or column to choose); a confirmation dialog for
  the download.
- **Cost**: the client's invoice rows read the payments and the superseding notes (`clientInvoices`), one sub-query each.
- **Signal we are wrong**: clients write to the shop to ask whether an invoice is paid, or erase a file while looking for the copy.

## The Mac menu is the rail (Phase 2, D9, #336)

- **Decision**: the « Aller » menu lists the web rail's five places, in its order and words, in the Mac's language: ⌘1 Aujourd'hui ·
  ⌘2 Clients · ⌘3 Factures · ⌘4 Livres · ⌘5 Boutique (Today · Clients · Invoices · Books · Shop). Each opens the web's address of the
  shop on screen — Boutique is `/boutique`, the hub — else the web's short address. A test of the web reads the Mac's table and
  refuses an address that is not a live page (`lib/app-addresses.test.ts`). The point of sale of #79 is out: Akinaza serves
  service businesses, the POS stays a stub.
- **Problem**: the menu kept the order of an older rail (Factures before Clients) and the word « Commerce »; ⌘5 opened
  `/fr/app/<shop>/shop`, the address « Ma page boutique » had before K4, kept only as a redirect.
- **Principle**: consistency (the same five places, the same order and the same digits on every surface).
- **Refused**: a menu of its own for the Mac; a countertop/POS mode (restaurants, cafés and bars are excluded by law, AGENTS § 2).
- **Cost**: a web test that reads a Rust table.
- **Signal we are wrong**: owners press ⌘3 for Clients by habit of the old menu.

## Motion in the product register: a changed row washes once (Phase 2, D11, #338)

- **Decision**: on Factures, a row whose state, payments or amount changed since the page's previous read — a payment recorded
  here or by someone else, a credit note — **washes once** (`data-kz-arrive` in the row, `data-kz-arrival="flash"` on the list:
  @krizaka/ui motion.css, an accent that fades). The page's arrival washes nothing (`lib/wash.ts`: the first read is the
  reference). The control that succeeded **rings once** (`data-kz-status="success"`): « Commencer » / « Terminer » on Aujourd'hui,
  « Envoyer la facture ». Under reduced motion nothing moves and the changed row keeps a **static marker**, an inset accent edge
  (the one local motion rule, until krizaka-ui#680). Only a background and a ring animate: no layout property (test).
- **Problem**: after an action or a re-read, nothing said which row had changed; the eye compared the list by itself.
- **Principle**: visibility of system status, with motion that explains a change and never decorates an arrival.
- **Refused**: animating every row on arrival; a toast per change; a wash on Aujourd'hui's agenda by a copy of `Agenda` (it waits
  for krizaka-ui#680, which lets the row carry the marker); the bulk-action wash before D10 (#337, blocked on krizaka-ts#89).
- **Cost**: the previous read's signatures kept per list (React state); one CSS rule to remove with krizaka-ui#680.
- **Signal we are wrong**: owners miss a change that washed while they looked away (then a persistent marker), or find the wash
  distracting on a list that re-reads often.

## The phone app: the web's five places at the web's addresses (Phase 2, D8, #335)

- **Decision**: the tab bar is the web rail — **Aujourd'hui · Clients · Factures · Livres · Boutique**, in its order, words and
  icons (`TABS` in `src/domain/links.ts`). Every screen lives at the web's address of the shop (`/fr/app/<shop>/aujourdhui?day=`,
  `/clients?q=`, `/invoices/new?client=`, `/books?period=`, `/boutique`), so a link opens the same place on both; every call names
  the shop (`?shopId=`) and every cache key carries it. **The calendar folds into Aujourd'hui** as a two-week `DayStrip` with the
  days that have appointments marked; **the settings move under the avatar** (`/fr/app/profile`, the account's). **Livres** reads
  the period's GST/QST nets from a new `GET /api/walker/books` (prepared, never filed); **Boutique** shows the shop, its tax status
  and its services, the long forms staying on the web. Every tab tells its three states (`QueryStates`: the beaver while reading,
  the error in place with « Réessayer », the empty state with what will fill it). The old addresses still land somewhere true.
- **Problem**: five tabs that were not the web's (Calendrier and Réglages as places, no Livres, no Boutique), short addresses
  without the shop, an error as a red sentence over an empty list.
- **Principle**: consistency and standards (one product, one map), recognition rather than recall.
- **Refused**: a native Boutique editor (the page, team and hours are a desk's forms); a copy of `LineItems` or `Agenda` here —
  the quick invoice and the day wait for krizaka-ui#629 (native `LineItems`/`TotalsSummary`) and #628 (native `Agenda`).
- **Cost**: the day's answer names its shop and time zone; one more walker route.
- **Signal we are wrong**: owners look for the calendar as a tab, or open the web for the books on their phone.

## D10 — The shop organises its clients and invoices (akinaza#337)

- **Decision**: tags belong to **the shop** (owner and manager write them, a client never sees them), with a colour marker of the closed
  palette (a dot, never the only signal: the name is always there). A shop starts with the administrator's default tag set for its
  trade and language, seeded once (a deleted tag does not come back). **The binder's dividers are the tags** (`Tabs.Nav
  variant="binder"`): « Tous » and one divider per tag with its count, the address is the state (`?tags=`), so a divider is a link and
  back/forward and a shared link keep it. **Saved views** are links too — the administrator's (« À encaisser », « En retard »,
  « Payées »), the shop's shared ones and mine — and « Enregistrer cette vue » appears when the filters in force are not one of them.
  **The selection bar tags and untags** (at most 200, one call, one audit line per row) next to the export. The client's file opens on
  the **profile banner** and carries its tags beside the contact, editable by those who write tags.
- **Problem**: a growing list of clients and invoices with no way to group, find or triage them, and no way to come back to « the
  late ones » in one tap.
- **Principle**: the URL is the state; recognition rather than recall; the colour is never the only signal.
- **Refused**: **a bulk status on invoices** (and any hand-set status): an invoice's state is derived from the ledger (paid, partial,
  overdue…), so « mark as paid » would lie — a payment is recorded as a payment. A tag colour picked freely (hex): a closed palette
  keeps both themes legible. Per-user private tags: a shop's vocabulary is shared.
- **Cost**: none left. Since Krizaka UI 3.59 the screens wire the package's `TagChip`, `MarkerPicker`, `TagSelector creatable`, `SavedViews` and `DataTable bulkActions` to the shop's routes (`components/app/organize.tsx` draws none of them); the administrator edits the sets with `TagSetEditor` / `StatusSetEditor` (`/console/organize`). A saved view is the author's own (the « share with the team » switch left with the local dialog).
- **Signal we are wrong**: owners ask for « mark as paid » on a selection, or never use a tag.

## D12 — The signed-in app wears the product register 2027 (akinaza#352, ADR-006)

- **Decision**: every page roots on `data-surface="product"` and loads `@krizaka/ui/blocks.css`, so the 3.55 register applies without a
  component change: slate ink, hairlines for cards only and a visible edge on every field (`--kz-border-control`), radius 14 on cards
  and 8 on controls, the lift on a card that is a link. Titles are Plus Jakarta Sans (`--kz-font-product-display`, from `@krizaka/fonts`
  0.5, weights 550 to 700); the page title and a figure's value are 700 by the register, so the app keeps no `h1` rule of its own.
  The public shop pages keep the Cahier paper (ADR-006 §4).
- **Problem**: the app drew its own `h1` weight and read the older sans-only register.
- **Principle**: one register for the family's products; a local override is a debt with a name.
- **Refused**: a local `h1` rule, a copy of the font file, Google Fonts.
- **Cost**: none in components; the files with a `rounded-*` use the radius roles and follow.
- **Signal we are wrong**: titles read as a template in the captures; going back is one token (`--kz-font-display: var(--kz-font-sans)`).

## Krizaka UI 3.59 adopted (akinaza#337, #352)

- **Problem**: four stand-ins waited for the package (tags and views, the admin's editors, Appearance, the booking weeks).
- **Principle**: no hand-written copy of a block; the product keeps only the wiring to its routes.
- **Chosen**: the invoice's derived state is the package's `StatusChip` over the administrator's status set, read-only (no `onMove`: the ledger moves it). Settings offer the product register's themes only — System, Light, Dark, then the optional Blueprint and Carbone surfaces — with the density and the language; no accent row (Akinaza keeps its forest green and copper) and no sound. The Cahier papers stay the public shop pages'. Booking shows the times by week (← This week →) and by part of the day (morning, afternoon, evening, cut at noon and 17 h on the shop's clock), the shop's time zone said under them.
- **Refused**: an accent choice (the brand is the product's identity); a sound nobody asked for.
- **Cost**: the booking page browses at most eight weeks ahead; the engine answers a week with nothing free with the empty line.
- **Signal we are wrong**: owners ask to share a view with the team from the bar, or clients ask for a later week than eight.

## The shop as a place: the studio of the wall, the board, the video and the reviews (akinaza#317, #310, #311, #312, #313, #314)

- **Problem**: the page promised a wall, a video, a board and reviews (« being prepared ») and the owner had no place to dress them.
- **Principle**: one place, Boutique › Page, with the live preview beside it on a desktop and behind « View the page » on a phone; the owner and the manager write what is pinned on the page, the identity and the publication stay the owner's.
- **Chosen**: the wall is composed on a 16:9 stage and moved by keyboard (arrows, Shift for larger steps, `[` `]` to tilt, Page Up/Down for the layer) or with sliders - no drag is needed, and a move is announced in words. Every bound (0-100 %, ±8°, 40/140/500 characters, the administrator's item count) is checked on what was sent, then by the database. The video is an upload checked by its bytes (the container's own header gives its length) or a link to a TikTok, a YouTube Short or an Instagram reel on an exact host; profiles are plain links, nothing from a platform loads before a click (Loi 25). A review shows a first name and an initial; the owner replies in public or hides it, never edits it.
- **Refused**: a drag-only editor; a free colour or font; a client's surname or e-mail on a review; a third-party script or image on the page.
- **Cost**: reviews are a small table here until `@krizaka/reviews` is published (krizaka-ts#37), then they move. `frame-src` of the page now names the three embed hosts (and this origin, for the preview) instead of `none`.
- **Signal we are wrong**: owners ask to drag pieces by hand, or lose a move because the keys are not found.

## The shop as a place, on the public page (B45, part 2; akinaza#310, #312, #313, #314, #315)

- The page draws what the owner pinned, and nothing empty: the wall (Krizaka UI's `Wall`, a real list underneath, at most twelve pieces drawn), the shop's latest video in a `RetroTv` beside it, the bulletin board (three flyers at most, each with its whole text, newest first, gone after its last day), the verified score (`ReviewSummary` + three `ReviewCard`s, nothing under the administrator's minimum) and the profile links. A section with nothing to show is not drawn, so a new shop keeps its page.
- **Another channel's video never loads before a click** (Loi 25): a TikTok, a YouTube Short or an Instagram reel sits behind `EmbedFacade`, whose poster is ours; the profile links are plain anchors with `rel="noopener noreferrer nofollow"` and no referrer. The page's CSP allows a frame only for those three hosts, and a frame exists only after the button was pressed.
- The video player speaks the page's language (its labels come from the catalogues); the shop's own video plays in the television, muted and only while on screen.
- The booking journey wears a **thin paper head** on steps 1, 2 and 4 (the shop's name in the display face, « Step 2 of 4 · The time », « Edit » on the time step) and the confirmation presses a « booked » stamp once. No wall, tilt, doodle or texture reaches a form; the skeleton carries a box of the head's height.


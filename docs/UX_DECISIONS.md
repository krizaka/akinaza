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

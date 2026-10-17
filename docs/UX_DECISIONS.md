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

## Connections (ADR-002)

- **Nothing changes without a choice.** An import is a proposal: each differing field shows Akinaza's value and the platform's side by side, with no choice pre-selected; « Apply my choices » is disabled until one is made. The choice is two plain radios (« Keep Akinaza's » / « Use Google's »), a vertical list so it never overflows a phone.
- **Consent is a step, not a banner.** « Connect » opens the words of what will be read and written; the continue button stays disabled until the unticked box is ticked (Loi 25).
- **Disconnect needs a second press** (ConfirmButton), and says what it does at the platform.
- **Platforms without an API** (Apple Maps, Bing, Yelp) are honest cards with a link and Akinaza's values to paste, not greyed-out buttons.

# ADR-001 — The generic "service shop" model

- Status: accepted (2026-10-17)
- Issue: krizaka/akinaza#52 (the dog walker is the first proof)
- Deciders: Akinaza product session; Oussama (the use case)

## Context

Akinaza is the all-in-one for independent Québec shops. Its first vertical use case is a dog walker, but the same
bones serve a hair salon, a groomer, a tutor, a cleaner: a shop that sells **time** (a service), with a bounded
**capacity**, booked by **clients** who may bring **dependants** (a dog, a child, a cat), produces a **visit
report**, and bills with GST/QST. The schema already had shops, staff, services, weekly schedules, clients with
Loi 25 consents, appointments (no double booking, by the database), invoices and an append-only tax ledger. What it
lacked is the rest of the vertical-neutral service-shop vocabulary.

Hard requirements: Akinaza prepares, never files; money is integer cents; the ledger is the authority; Loi 25
(consent, erasure, export, data in Canada); an access code (door code, key location) is encrypted at rest;
French first, English second; AI only through Orazaka; every parameter that changes behaviour is data.

## Decision

One model, vertical-neutral names, vertical details in validated JSON. Nothing in the tables says "dog".

| Concept | Table | Notes |
| :-- | :-- | :-- |
| Shop page | `shops` (+ `slug`, `published`, taglines) | public at `/{locale}/s/{slug}`; a custom domain later |
| Zone served | `shop_zones` | a named area (Saint-Henri, Griffintown…); an appointment belongs to one |
| Service | `services` (+ `capacity`, `zone_required`) | `capacity` is the most dependants per visit: 1 = individual, N = group |
| Availability | `schedules` (weekly windows per staff) + `days_off` | recurring slots and exceptions; slots are computed, never stored |
| Rules | `shop_rules` | cancellation window, booking horizon, slot step, report-link life: data per shop, defaults seeded by migration, bounds in `CHECK`s |
| Client | `clients` (+ `account_id`, `access_notes_enc`) | the shop's file on a person; linked to a sign-in account when the person signs in |
| Dependant | `dependants` | `kind` (`dog`, `cat`, `other`), `name`, `profile` JSON validated by the vertical's schema in `@akinaza/core` (breed, size, temperament, vet, emergency contact) |
| Visit | `appointments` (+ `zone_id`, `checked_in_at`, `checked_out_at`) | one block of staff time; `EXCLUDE` keeps a staff member from being in two places |
| Booking | `bookings` | one dependant on one visit. A group walk is **one** appointment with several bookings, capped by `services.capacity` |
| Visit report | `visit_reports` | per booking: note, photo, duration, a view token (hash), the mail it produced |
| Outgoing mail | `mail_outbox` | what was said to whom, rendered; delivered by the provider when configured |
| Invoice | `invoices` … `tax_ledger` | unchanged; a visit or a package will issue one (next slice) |

### Why a booking is not an appointment

A group walk of five dogs must occupy the walker once. If every dog were an appointment, the exclusion constraint that
protects the walker from double booking would refuse the second dog. So the appointment is the *staff's time*
(protected by the database) and the booking is the *dependant's seat* in it (protected by a capacity check taken
under a row lock on the staff member). Individual services are the capacity-1 case; a salon appointment keeps
working unchanged (`appointments.client_id` stays for a visit with a single client).

### Slots are computed, not stored

`@akinaza/core` `openSlots()` is pure: weekly windows, days off, the shop's time zone, the service length, the step,
the horizon, the visits already taken and the clock (injected) give the offered start times. A group visit with free
seats of the same service and zone is offered as joinable ("2 of 5 dogs"); anything else overlapping is not offered.
The database remains the judge at write time (`EXCLUDE` + capacity under lock), so a race ends in a refusal, never in
a double booking.

### Access notes are encrypted at rest

`clients.access_notes_enc` holds AES-256-GCM ciphertext, `v1.<iv>.<tag>.<data>` (base64url), with the client's id as
additional authenticated data (a ciphertext copied to another row does not open). The key is the environment variable
`APP_DATA_ENCRYPTION_KEY` (32 random bytes, base64), declared in `lib/env.ts`, a DigitalOcean SECRET, never in the
database, required to start in production. The list screens never carry the notes: the walker reveals them for one
client with an explicit call, which is written to the audit log. Rotating a key is a prefix (`v2`) and a re-encrypt job.
This protects against a leaked database or backup; it is not a defence against a compromised application server.

### Loi 25: consent, export, erasure

- Consent per purpose, append-only (existing). The visit report is part of the service (`service`); reminders need
  `reminders`; a client who withdrew `service` receives no report.
- **Export**: the client downloads everything held about them in one JSON file (file, dependants, bookings, reports,
  consents; access notes decrypted for them, photos listed by id), from their own space.
- **Erasure**: blanks the client's personal fields, the access notes, every dependant (name `—`, profile `{}`), the
  notes and photos of their reports, unlinks the sign-in account; keeps the invoices tax law requires (six years). A
  visit that already happened is kept as an anonymous fact (the walker's own record of working that day).
- Photos are personal data of the client's home and pet: they live with the report and go with it.

### Reports and mail

`@krizaka/email` is not published yet. The report is rendered with Akinaza's own bilingual templates
(`mail-templates/walk-report`, the krizaka-notifications format) and written to `mail_outbox`; a provider module
(`MAIL_PROVIDER`, `MAIL_API_KEY`, `MAIL_DOMAIN`, `MAIL_FROM`) delivers it and fails closed: without configuration the
mail stays `pending`, the report is still available to the client in their space and by its private link. Swapping the
renderer for `@krizaka/email` later replaces only `lib/mail.ts`. The photo is not attached: the mail links to the
report page (`/{locale}/report/{token}`), whose token is random, stored hashed, and expires (`shop_rules`).

### AI

A draft of the report text from the photo and the note is an Orazaka Studio call (`AI_API_URL`, Akinaza's `oz_`
key). Akinaza's dev deployment has no service key yet and Orazaka has no such Studio, so the first slice writes the
report by hand and the draft is a follow-up (the walker always edits and sends; nothing is sent by the AI).

## Consequences

- A salon, a groomer or a tutor is configuration plus a `dependants` profile schema (or none), not a new schema.
- Two more tables of personal data to erase and export; both are covered by tests on a real PostgreSQL.
- Photos are stored as `bytea` in PostgreSQL for now (a resized JPEG, 1.5 MB at most) to avoid a new paid
  resource; they move to object storage (`MEDIA_`) when volumes justify it. Filed as a follow-up.
- Packages (weekly recurring), invoices per visit, SMS reminders and online payment are the next slices; the model
  leaves room (a booking gains a `package_id`; invoices already point to appointments).

## Rejected

- *A "pets" table.* Locks the schema to one vertical; the next shop would copy it.
- *Storing slots.* Needs a sweeper, drifts from the schedule, doubles the places a rule can be wrong.
- *Encrypting in the database (pgcrypto).* The key would travel in SQL and in logs.
- *Hard-coding the cancellation window.* It is the shop's business rule: it lives in `shop_rules`.

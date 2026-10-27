# ADR-004 — Calendar sources and the owner's exports

- Status: proposed (2026-10-26, krizaka/akinaza#282, phase 1). Waits for « validé » from Claude (CTO) before any code.
- Deciders: Akinaza owner-side session; Oussama (the request, 2026-10-23).
- Design: [`docs/design/calendar-sync.md`](../design/calendar-sync.md).

## Context

An owner already lives in a calendar and a phone. Akinaza should **read** what they already use (busy times, existing
appointments) and **give back** their own data in formats their tools take, without locking anything in. Akinaza
prepares and never files (AGENTS section 2); nothing here touches taxes.

## Decision

1. **Akinaza stays the source of truth for its own appointments.** An imported event is *shown and blocks time*; it is
   never edited, moved or deleted from Akinaza. Writing a booking into the owner's calendar (two-way) is **later**, not now
   (it needs write scopes, a second consent and conflict handling for little gain: the private ICS feed gives phones the
   same view with no OAuth).
2. **Two ports, one adapter per provider or format** (krizaka-ts ADR-001: modules, ports, outbox):
   - `CalendarSource` (`@akinaza/core` type, adapters in `apps/web/lib/calendar/`): `authorizeUrl`, `exchange`,
     `listCalendars`, `busy(range)`, `events(range)`, `subscribe`/`renew` (where the provider pushes), `revoke`.
   - `Export` (`@akinaza/core` type): `format(shop, subject) -> { contentType, filename, body }`, one function per format.
3. **Sources, with the minimum read-only scope** (provider documents read 2026-10-26):
   | Source | Auth | Minimum scope | Change feed |
   |:--|:--|:--|:--|
   | Google Calendar | OAuth 2.0 | `calendar.freebusy` (busy only, the default) or `calendar.events.readonly` (to show the events) — [scopes](https://developers.google.com/workspace/calendar/api/auth) | push channel per calendar (HTTPS `watch`, no body, no auto-renewal: renew before expiry, `channels/stop` on revoke), plus polling because notifications are not guaranteed — [push](https://developers.google.com/workspace/calendar/api/guides/push) |
   | Microsoft 365 / Outlook | OAuth 2.0 (Graph) | `Calendars.ReadBasic` (least privileged for `calendarView`; `Calendars.Read` only if the owner wants event titles) — [calendarView](https://learn.microsoft.com/en-us/graph/api/user-list-calendarview?view=graph-rest-1.0) | polling `calendarView` on a window; Graph subscriptions are a later optimisation |
   | iCloud and any CalDAV | app-specific password (iCloud) or server credentials, over HTTPS | read only (`REPORT` free-busy / calendar-query, RFC 4791) | polling (`ctag` / `sync-token`, RFC 6578) |
   | ICS URL | none (the URL is the secret) | read only | polling with `ETag` / `If-Modified-Since` |
   The first release reads **busy times only** (no titles, no attendees): the smallest scope, the smallest Loi 25 surface.
4. **Busy time blocks slots.** `availability` subtracts imported busy intervals. A conflict between an Akinaza
   appointment and an imported event is **never resolved by deleting either**: Akinaza keeps its appointment, flags the
   overlap to the owner in Today (« chevauche votre agenda Google »), and the owner decides.
5. **Exports** (the owner's data, to their tools):
   - **A private ICS feed** per shop and per staff member (RFC 5545), subscribed to by Google, Apple and Outlook. Its URL
     holds a random 256-bit token; only a **keyed hash** is stored; the owner can **rotate** (new token, old one dead at
     once) and **revoke**. The feed carries first name and service only, never a phone, an e-mail or a note. It is
     not cached by shared caches (`Cache-Control: private, no-store`) and is served with the token in the path, not a query.
   - **Data exports**: clients (CSV, vCard), bookings (CSV, ICS), invoices (CSV, and a PDF archive in a zip), books and
     taxes (CSV in the lines of the prepared return). « Télécharger toutes mes données » zips them all and **is** the
     Loi 25 portability export (it reuses `@krizaka/privacy`, B55). Exports are generated on demand, streamed, never stored.
6. **Tokens** are sealed with `sealField` (the shop's data key, `packages/db/src/crypto.ts`), never logged, never returned
   by any route; revocation deletes them **and the imported busy intervals** of that connection.
7. **Sync jobs** are idempotent and per connection: scheduled (the administrator's interval) and webhook-driven, with
   exponential backoff and a visible state (`ok`, `error`, last success). A reaction (a slot freed, an overlap flagged)
   goes through the outbox.
8. **Shared module?** The ICS and CSV/vCard writers and the CalDAV/ICS readers are generic: they go to
   **`@krizaka/calendar`** (krizaka-ts, a new module — issue to open there before phase 2). OAuth adapters for Google and
   Microsoft stay in Akinaza (they hold its client ids and its consent texts). If krizaka-ts does not take the module
   first, the writers live in `packages/core/src/exports/` and move later; the ports do not change.
9. **The administrator configures everything** (charter section 8): `features.calendarSync`, per provider
   `calendarSync.<provider>.enabled`, `calendarSync.intervalMinutes` (bounded), `calendarSync.maxCalendarsPerShop`,
   `calendarSync.windowDays`, `exports.icsFeed.enabled`. Settings in the database, audited, no rebuild.
10. **Privacy (Loi 25)**: consent and purpose per connection (« lire mes heures occupées pour bloquer mes plages »), recorded
    append-only; minimum data (busy intervals, no titles by default); retention = while connected, deleted on revoke; an
    audit line for every connection, sync failure, export and token rotation; no client data in any public URL (the feed
    token is the only secret and carries no client identity).

## Refused

- Two-way write now: scopes, consent and conflicts for a gain the ICS feed already gives.
- Storing event titles or attendees by default: more data than blocking a slot needs.
- A feed URL with a guessable id or a shared token for a whole account: one token per feed, rotatable.
- Calling providers from the browser: tokens never leave the server.

## The cut (one pull request each, in order)

1. **ICS feed** (shop and staff): token table, rotate and revoke, the feed, its tests (token never stored in clear,
   rotation kills the old URL, no personal data in the body, 404 for a revoked token).
2. **Data exports**: clients (CSV, vCard), bookings (CSV, ICS), invoices (CSV, PDF zip), books (CSV), « all my data ».
3. **`CalendarSource` port + the ICS URL source**: the busy intervals table, the availability subtraction, the overlap flag.
4. **Google** (`calendar.freebusy`): OAuth connect, pick calendars, sync, push channel renewal, revoke.
5. **Outlook** (Graph, `Calendars.ReadBasic`).
6. **CalDAV / iCloud**.
7. **Two-way write** — only if the owners ask.

Tests use recorded provider answers: no network, no real account.

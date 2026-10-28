# Calendar sync and exports — design (#282, phase 1)

Decisions are in [ADR-004](../adr/ADR-004-calendar-sync-and-exports.md). This page is the owner's side of it.

## Owner screens (built from @krizaka/ui, French first, dark and light, phone and desktop)

Where: **Boutique › Agenda** (a new section of the hub, next to Team), because it configures the shop. Today only shows the
overlap flag.

1. **Connected calendars** — a `Card` per connection: provider mark, account, the calendars picked (`Switch` each), « Dernière
   synchronisation il y a 4 min » or the error in place with « Réessayer », « Déconnecter » (confirm: « Cela supprime aussi les
   heures occupées importées »). A « Connecter Google Agenda » / « Connecter Outlook » / « Ajouter un lien ICS » button group.
   Before OAuth, a consent card says purpose, what is read (busy times only), retention, and how to revoke.
2. **Mon agenda sur mon téléphone** — the private ICS link: read-only field with copy, a **QR code** to open it on the phone
   (Apple: « Ajouter un calendrier »; Google: « À partir de l'URL »), « Régénérer le lien » (the old one stops at once) and
   « Désactiver ». One link per staff member for the owner and the manager; staff see only their own.
3. **Exporter mes données** — one `DataTable`-free list of formats (clients CSV/vCard, rendez-vous CSV/ICS, factures CSV/PDF,
   livres CSV) each with « Télécharger », and « Télécharger toutes mes données » on top (the Loi 25 portability export).
4. **Today** — an imported busy interval is a hatched block « Occupé (Google) » without title; an overlap is a quiet banner line
   with the appointment, never a modal.

Missing blocks (a QR display, a copy field with status) become krizaka-ui issues before phase 2.

## Data

- `calendar_connections(id, shop_id, staff_id?, provider, account_label, sealed_token, scope, consent_text_version, status, last_ok_at, last_error, created_at)`
- `calendar_busy(connection_id, calendar_ref, starts_at, ends_at, source_etag)` — replaced per window on each sync.
- `feed_tokens(id, shop_id, staff_id?, token_hash, created_at, rotated_at, revoked_at)` — keyed hash only.
- Every table classified in `tenancy.ts` (`shop` or `child`).

## Failure and abuse

- A provider outage never blocks booking: the last good busy intervals stay, stamped; past `calendarSync.windowDays` of silence
  they stop blocking and the owner is told.
- Token endpoints are rate-limited; the feed path answers 404 for an unknown, rotated or revoked token (never 403).
- Webhook endpoints verify the channel token / `clientState` and do nothing but schedule a sync.

## Admin

`features.calendarSync`, `calendarSync.<provider>.enabled`, `calendarSync.intervalMinutes` (bounds 5 to 240),
`calendarSync.maxCalendarsPerShop`, `calendarSync.windowDays`, `exports.icsFeed.enabled` — the console's settings page, audited.

## Provider documents read (2026-10-26)

- Google Calendar, scopes: https://developers.google.com/workspace/calendar/api/auth
- Google Calendar, push notifications: https://developers.google.com/workspace/calendar/api/guides/push
- Microsoft Graph, List calendarView (permissions, window query): https://learn.microsoft.com/en-us/graph/api/user-list-calendarview?view=graph-rest-1.0
- CalDAV RFC 4791, `sync-token` RFC 6578, iCalendar RFC 5545 (IETF).
- Not yet verified for this phase: Apple's current iCloud app-specific-password rules and Google's scope verification tier
  (the scopes page does not classify them); both are checked in the PR of their adapter.

# ADR-002 — Social and listings sync: Akinaza is the source of truth

- Status: retired (2026-10-22, krizaka/akinaza#174). Accepted 2026-10-17; the screen went in #161, the routes, module and tables in #174. Resumes with #74 (Google / Meta access), from `git log` and the research note in the history.
- Deciders: Akinaza integrations session; Oussama (the request)

## Context

Shop owners keep their hours, description, phone and photos in Google Maps, Facebook, Instagram, and later more. They
want Akinaza to sync with their own accounts. Only some platforms allow it, each with its own approval, quotas and
data model.

## Decision

1. **Akinaza is the source of truth** for the storefront. Platforms are *mirrors*. Nothing leaves Akinaza without the
   owner connecting the account; nothing enters Akinaza without the owner accepting it.
2. **One connector per platform behind one interface** (`@akinaza/core`, `SocialConnector`):
   `authorizeUrl`/`exchange` (OAuth `connect`), `pull`, `push`, `status`, `revoke` (`disconnect`). Platforms with no
   API (Apple, Yelp, Bing) are *guidance cards*, not connectors.
3. **Pull is a proposal.** `pull` reads the platform's profile, compares it field by field with the storefront and
   stores a **proposal** (`sync_proposals` + `sync_proposal_items`). The owner decides each differing field: *Take
   theirs* (Akinaza changes) or *Keep Akinaza's* (the platform will be updated on the next push). Nothing is applied
   before that decision.
4. **Push never overwrites an undecided difference.** `push` sends Akinaza's value for each mapped field that differs
   on the platform, except fields with an open proposal item. « Google says 9:00, Akinaza says 8:00 »: the owner picks
   in the proposal; a field left alone is never silently overwritten either way.
5. **Field mapping is data** (`FIELD_MAPPINGS`: per platform and field the remote name, direction `both | pull | push`,
   limits such as description length). Adding a platform or field is data plus a test, not control flow. Values are
   compared in a canonical form (digits of a phone, merged hour runs, normalised website) so formatting is never a
   conflict.
6. **A sync log per field**, append-only (`sync_log`): shop, platform, field, direction, outcome (`pulled`,
   `proposed`, `accepted`, `kept_local`, `pushed`, `failed`, `skipped`), time, a scrubbed detail. Shown to the owner.
7. **Retry and rate limits.** Connectors throw `ConnectorError` of kind `rate_limited` (with `retryAfterMs`),
   `transient`, `auth` or `invalid`. `withRetry` retries `rate_limited` and `transient` with exponential backoff and
   full jitter, bounded; `auth` marks the connection `needs_reconnect` and stops; `invalid` is recorded per field.
   Per-platform limits (Google: 10 edits/min/profile) are *data* on the connector (`limits`), and push batches one
   patch per profile.
8. **Tokens**: sealed with `APP_DATA_ENCRYPTION_KEY` (AES-256-GCM, connection id as AAD), minimal scopes, revocable,
   never returned by an API, never logged. Everything written to the log or an error passes `scrub`, which drops
   token-looking keys and replaces any known secret string. The OAuth `state` is HMAC-signed (shop, platform, expiry).
9. **Consent first** (Loi 25): connecting requires an explicit, unticked-by-default consent; its text version is stored.
10. **Environment** by bounded context: `APP_SOCIAL_SYNC` = `off` (default) | `fake` (dev, tests; refused in
    production) | `on` (real connectors, each additionally needs its own `AUTH_<PLATFORM>_CLIENT_ID` / `_CLIENT_SECRET`
    — Google and Meta in slices 2–3). Secrets via `secret.sh`.

## Where the connectors live: Akinaza now, Orazaka later

The family rule is that external integrations go through Orazaka's connector layer. Decision: **Akinaza owns a thin
adapter module now** and moves it behind Orazaka's connector later, exactly as Kachizaka did, because:

- the interface above is the seam: an Orazaka connector replaces the adapter without touching the screens, the proposal
  model or the log (the connector would own OAuth and token custody; Akinaza would keep the mapping and decisions);
- Orazaka has no generic OAuth-token-vault connector for listing platforms yet; waiting would block slice 2 on a
  platform change in another repository, which is a cross-team dependency without a benefit for one tenant;
- tokens stay in Akinaza's database, in Canada, under its key, until the Orazaka vault exists.

Migration trigger: when Orazaka ships a connector with token custody and revocation, each Akinaza connector becomes a
client of it (one platform per PR), and `social_connections.token_enc` is dropped.

## Consequences

- Slice 1 ships with a fake connector and every screen, without any platform approval.
- A new platform = a mapping entry + a connector + tests against the interface's contract suite.
- Hours are applied to the owner's weekly schedule (replacing it); the owner sees the diff before accepting.
- We ignore reviews, and anything with customers' personal data, for now.

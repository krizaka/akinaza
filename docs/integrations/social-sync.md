# Social and listings sync — what each platform allows (research, 2026-10-17)

Epic: owners keep their Akinaza storefront (hours, description, phone, website, photos) in step with Google Maps,
Facebook, Instagram and the other places customers look. Decision record: [ADR-002](../adr/ADR-002-social-sync.md).
Every claim below cites its source; **« to verify »** marks what the sources did not settle and must be checked the day
the integration is built (platform terms move).

## Summary

| Platform | Read the owner's data | Write the owner's data | Approval before real owners | Cost | Verdict |
| :-- | :-- | :-- | :-- | :-- | :-- |
| Google Business Profile | hours, description, phones, website, photos, posts, reviews | same (patch with a field mask), post, reply to a review | **Yes**: GBP API access request (manual review), OAuth consent screen verification for the sensitive scope | Free | **Slice 2** |
| Facebook Page (Meta Graph) | page info, hours, cover, posts | `about`, `description`, `hours`, `phone`, `website`, posts (Page access token) | **Yes**: App Review for the Pages permissions, then Business Verification for Advanced Access | Free | **Slice 3** |
| Instagram professional | profile and media | publish media, moderate comments; **profile fields (bio) are not documented as writable** | **Yes**, same app review | Free | Slice 3, **photos and posts only** |
| Apple Business Connect | web portal only for an owner | a Location API exists but is reached through partners (Yext, SOCi, Uberall, Reputation…), no self-serve developer program found | Partner agreement | Partner fees | **Not now**: deep link to the owner's portal |
| Yelp | Fusion API: public data, **read-only** | no owner write on the public API; response to reviews, leads, ads are partner tier | Partner agreement | Partner / paid tiers | **Not now**: guidance text only |
| Bing Places | portal only | **no public API found**; the portal has « Import from Google » | none (portal) | Free | **Not now**: guidance text; Bing imports from the owner's Google listing itself |

## Google Business Profile

- **Who can use it.** The API is not open: the Google Cloud project must be approved through the GBP API contact form
  (« Application for Basic API Access »). The requester needs a Business Profile that is verified and active for 60+
  days and has a website. Approval shows as a project quota of 300 QPM (0 = not approved).
  [Prerequisites](https://developers.google.com/my-business/content/prereqs).
- **OAuth.** One scope, `https://www.googleapis.com/auth/business.manage`; an OAuth client ID is created in the Google
  Cloud console. [Basic setup](https://developers.google.com/my-business/content/basic-setup). The scope is
  sensitive, so the consent screen goes through Google's OAuth verification before it works for outside users (to
  verify with the OAuth verification page at that time).
- **APIs.** Business Information (location data), Account Management, Verifications, Notifications, Place Actions,
  Lodging, Performance. Reviews, local posts and media still live in the legacy v4 My Business API (to verify which
  are retired at the time of slice 2). [Basic setup](https://developers.google.com/my-business/content/basic-setup).
- **What a location carries.** `regularHours`, `specialHours` (cannot be set without regular hours), `phoneNumbers`,
  `websiteUri`, `profile.description`, patched with `locations.patch` and an update mask.
  [Location resource](https://developers.google.com/my-business/reference/businessinformation/rest/v1/locations).
  `getGoogleUpdated` returns the version Google changed itself: the source of a **conflict**.
- **Quotas.** 300 QPM per project; **10 edits per minute per Business Profile (cannot be raised)**; Update Location
  10 000/day, Create Location 300/day. [Limits](https://developers.google.com/my-business/content/limits).
- **Cost.** The documentation shows no fee; Google may ask to enable billing on the project when enabling APIs, which
  does not by itself charge (to verify on the Pricing page).
- **Risk.** Google edits listings itself (suggested edits, merged data): never assume what we pushed is what is shown.

## Meta: Facebook Page and Instagram

- **Facebook Page.** `POST /{page-id}` edits `about`, `description`, `hours`, `phone`, `website`
  ([Page reference](https://developers.facebook.com/docs/graph-api/reference/page/)); the call uses a **Page access
  token** and `pages_manage_metadata`; reading content needs `pages_read_engagement`, posting `pages_manage_posts`
  ([Pages API](https://developers.facebook.com/docs/pages-api/)). Most Page management permissions are **extended
  permissions requiring App Review** (use case text and a screencast). The exact per-field permission mapping is not
  in the reference (to verify while building).
- **Instagram.** Only **professional** accounts. Two logins: Instagram Login (permissions `instagram_business_basic`,
  `instagram_business_content_publish`, `instagram_business_manage_comments`…) or Facebook Login (needs a linked
  Facebook Page). The documented writes are content publishing (images, videos, reels, carousels) and comment
  moderation; **no documented API to read or edit the profile or the bio**. Standard Access covers only accounts with
  a role on the app; serving other owners needs **Advanced Access: App Review and Business Verification**.
  [Instagram platform overview](https://developers.facebook.com/docs/instagram-platform/overview).
- **Quotas.** Page calls: 4 800 × engaged users per rolling 24 h per Page (error 80001), header
  `X-Business-Use-Case-Usage`; user/app tokens: 200 × users per hour.
  [Rate limiting](https://developers.facebook.com/docs/graph-api/overview/rate-limiting/). Instagram uses its own
  business-use-case limit (4 800 × impressions per 24 h).
- **Cost.** Free. Business Verification needs the company's documents (Krizaka's), not a fee.

## Platforms without a usable owner API

- **Apple Business Connect.** Owners manage Maps listings in the Business Connect web portal. A Location API exists but
  we found no public developer documentation or self-serve access; listing vendors (Yext, SOCi, Uberall, Reputation,
  Rio SEO) integrate by partnership ([SOCi announcement](https://www.soci.ai/insights/soci-to-support-multi-location-enterprise-businesses-through-apple-business-connect-api/),
  [developer forum question without an answer](https://developers.apple.com/forums/thread/730629),
  [Apple's portal guide](https://support.apple.com/guide/apple-business-connect/abcb91c1d565/web)). Treat as
  **no API for us**; Akinaza shows the owner the values to paste and a link to the portal.
- **Yelp.** The Fusion API is public-data read access (search, business details, review excerpts); partner tiers add
  review responses, leads, ads. Owner-side write is not offered to ordinary developers; paid tiers are reported (third
  party, to verify) at hundreds of dollars a month, far above our $5/month rule.
  [Yelp developer documentation](https://docs.developer.yelp.com/). **No API for us.**
- **Bing Places.** No public API was found. The new Bing Places (bing.com/forbusiness, October 2025) offers « Import
  from Google » in its dashboard, with optional recurring sync from the Google listing.
  [Search Engine Journal](https://www.searchenginejournal.com/microsoft-launches-new-bing-places-for-business/557520/).
  Best path: keep Google right, and tell the owner Bing can import from it. **No API for us.**

## Privacy — Loi 25 (Québec)

The owner connects their own accounts; the data is the business's (hours, description, public phone), except that
OAuth tokens give power over a third-party account, so they are treated as secrets.

1. **Consent before the connection**, for that purpose and that platform, in clear words, never pre-ticked, with the
   version of the text recorded (`consent_text_version`) like the clients' consents. The screen says what is read, what
   is written, and that the owner can disconnect at any time. (Commission d'accès à l'information: consent must be
   manifest, free, informed, given for specific purposes.)
2. **Minimal scope.** Google `business.manage` is the only scope and is broad; we call only Business Information
   fields we map. Meta: ask only `pages_manage_metadata`, `pages_read_engagement`, `pages_show_list`; add
   `pages_manage_posts` / `instagram_business_content_publish` only when posting ships.
3. **Tokens encrypted at rest** (AES-256-GCM, `APP_DATA_ENCRYPTION_KEY`, the connection id as authenticated data),
   never returned by the API, never logged, never in an error message (redacted), never in the browser.
4. **Revocation.** « Disconnect » revokes at the provider when it offers an endpoint (Google
   `oauth2.googleapis.com/revoke`; Meta: delete the app permission), then erases the stored token. The owner can also
   revoke from their Google or Meta account: the next call fails with an authentication error and the card shows
   « Reconnect ». Provider data deletion callbacks (Meta requires a deletion-request URL) erase the connection.
5. **Data in Canada.** The sync log keeps field names, decisions and outcomes, not the pulled personal content beyond
   the shop's public values; the diff keeps the two public values until decided, then is purged with the proposal.
6. **Third-party personal data.** Reviews contain customers' names: out of scope of slice 1 to 3 (we do not import
   them); they would need their own assessment.

## What we build first

Slice 1 needs no approval (connector interface, fake connector, screens, diff, log). Slice 2: Google (hours,
description, phone, website, photos). Slice 3: Meta (Facebook Page fields; Instagram photos and posts only). Apple,
Yelp and Bing: guidance cards, no connector.

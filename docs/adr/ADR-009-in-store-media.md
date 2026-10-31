# ADR-009 — In-store media: live events behind a streaming port, the short-videos TV first, « what we play » without third-party APIs

Status: **accepted** (CTO, 2026-10-30), **amended 2026-10-30** after the founder's cost call and principle (« less responsibility on our side, more flexibility for the users »): the default is **bring your own** (the shop streams with its own account and is controller and payer; we host nothing); our self-hosted Canadian origin is an optional **managed service, Entreprise only**. Figures are in the private issue (no prices in this repository). Issue: krizaka/krizaka-internal#1339 (ADR). Orientation: the written marketing × UX
meeting of krizaka/krizaka-internal#1340. Idea: krizaka/krizaka-internal#216.
Legal: best good-faith reading of the law, cited below; **one lawyer review before public opening** (marked ⚖).
ADR-008 is reserved for the owner services / entitlements ADR (krizaka/krizaka-internal#46); this one takes 009.

## Context (main, 2026-10-30)

| Piece | Today | Where |
| :-- | :-- | :-- |
| Short videos on the page | the owner's clips (our storage) and external reels (TikTok, YouTube Shorts, Instagram) shown in `RetroTv`, the external player loaded **only after a click** | `@krizaka/ui/retro-tv`, `apps/web/components/shop/ShopPageView.tsx`, `packages/core/src/community.ts` `externalReel` |
| Third parties a page may frame | `youtube-nocookie.com`, `tiktok.com`, `instagram.com` — nothing else | `apps/web/lib/csp.ts` `EMBED_FRAME_HOSTS` |
| Media files | the admin-configured storage provider, https addresses in the database | ADR-004, `apps/web/lib/media-storage.ts` |
| Ports with switchable adapters | payments (ADR-003, `@krizaka/payments`), storage (`@krizaka/storage`) | krizaka-ts |
| Live video | none | — |
| What the shop plays | none | — |

## Findings that shape the decision (sources read 2026-10-30)

1. **A CDN alone does not do live.** Amazon CloudFront delivers files; a live service also needs ingest (RTMPS/SRT/WebRTC),
   transcoding to an adaptive ladder, packaging (HLS) and a player. On AWS that is IVS (managed) or MediaLive + MediaPackage
   + CloudFront (assembled). CloudFront alone does not fit.
2. **No managed live service we checked states Canadian storage on its public offer.**
   - Amazon IVS low-latency endpoints: us-east-1, us-west-2, ap-south-1, ap-northeast-1/2, eu-central-1, eu-west-1 — **no
     ca-central-1** ([AWS General Reference, IVS endpoints](https://docs.aws.amazon.com/general/latest/gr/ivs.html)).
   - MediaPackage lists Canada (Central) ([MediaPackage endpoints](https://docs.aws.amazon.com/general/latest/gr/mediapackage.html));
     MediaLive in ca-central-1 is reported by AWS's region data but must be confirmed on the Regional Services List before use.
   - Cloudflare Stream and Mux publish no region choice on their pricing or live pages; Cloudflare's Data Localization Suite
     is an Enterprise product.
   - Bunny Stream Live was a **closed preview** (changelog, 2026-08-13) with no published live price, and the founder
     confirms Bunny has **no live product we can use**: Bunny is only the **CDN** that delivers our HLS
     ([Bunny Stream changelog](https://bunny.net/docs/stream/changelog)). Bunny CDN's Volume network is one global rate and
     the Standard network covers North America ([Bunny CDN pricing](https://bunny.net/pricing/cdn/), read 2026-10-30).
   - Self-hosting is possible with trusted open source: **MediaMTX** (MIT; RTMP/SRT/WebRTC in, HLS and LL-HLS out;
     [github.com/bluenviron/mediamtx](https://github.com/bluenviron/mediamtx)) and **Owncast** (MIT; single-streamer server
     with its own chat and UI, heavier than we need; [github.com/owncast/owncast](https://github.com/owncast/owncast)). A
     small DigitalOcean droplet in TOR1 (Toronto) gives a **Canadian origin**
     ([Droplet pricing](https://www.digitalocean.com/pricing/droplets), read 2026-10-30; no regional price difference
     stated, TOR1 availability to confirm at provisioning).
   → For any of the managed services, the video of identifiable people leaves Québec: an **EFVP (privacy impact assessment)
   before the first live** is required (Law 25, s. 17), and the privacy notice names where the files live.
3. **Recording controls exist where we need them.** Cloudflare Stream live inputs: `recording.mode` = `off` (default) |
   `automatic`, `deleteRecordingAfterDays` (30–1096), `requireSignedURLs`; ingest over RTMPS or SRT; ingest and encoding
   free ([Start a live stream](https://developers.cloudflare.com/stream/stream-live/start-stream-live/),
   [Stream pricing](https://developers.cloudflare.com/stream/pricing/), page updated 2026-10-27; WebRTC broadcasts cannot be
   recorded). Mux: `latency_mode` standard (~25–30 s) · reduced (12–20 s) · low (LL-HLS, ~5 s)
   ([Mux latency guide](https://www.mux.com/docs/guides/reduce-live-stream-latency)). IVS: low-latency (a few seconds) and
   real-time stages; recording to S3.
4. **Spotify forbids exactly this use.** Spotify Developer Policy (effective 2025-05-15), III.10: « Spotify is for
   personal, non-commercial use which means it can't be broadcast or played publicly from a business », and the same clause
   bars products « targeted for use by businesses, such as in-store or by retail employees ». Also II.4 (attribution and a
   link back for any metadata or cover art), III.6 (no sync of recordings with visual media), IV.2 (no commercial use of a
   streaming app) ([Developer Policy](https://developer.spotify.com/policy), [Developer Terms v10](https://developer.spotify.com/terms)).
   On top, Web API extended quota is for organisations with ≥ 250k monthly active users; development mode caps an app at 5
   users ([Quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)).
   → A « now playing from Spotify » card for shops is **refused**, not postponed.
5. **YouTube embeds are allowed with conditions** (YouTube API Services Developer Policies, updated 2026-10-15): never
   modify or block the player (III.I.6), never separate or play only the audio (III.I.7–8), no background player (III.I.9),
   autoplay off limits what is shared before interaction (III.E.4.i), and the privacy policy must say the page uses YouTube
   API Services and link Google's (III.A.2) ([Developer Policies](https://developers.google.com/youtube/terms/developer-policies)).
   → « YouTube as background music » is refused; a clip the visitor starts, inside the TV block, is fine.
6. **Music in a shop, and music in a stream, are two licences — the shop's.** Playing recorded music in a business needs a
   public-performance licence (SOCAN Tariff 15.A for authors; Re:Sound Tariff 3.A for performers and labels; one licence
   through Entandem, their joint venture). A live stream that carries that music is a communication to the public by
   telecommunication (Copyright Act, R.S.C. 1985, c. C-42, s. 3(1)(f)), which the in-store licence does not cover ⚖.
   → The owner UI says it plainly; « Go live » recommends no music or music cleared for streaming.
7. **The shop's own channel is a zero-cost path.** A shop that streams on YouTube Live, Instagram or TikTok keeps being
   the controller of its channel; the page may embed it after a click, as the short-videos TV already does (CSP
   `EMBED_FRAME_HOSTS`: `youtube-nocookie.com`, `tiktok.com`, `instagram.com`). YouTube live embeds must follow the Developer
   Policies of finding 5 and work for public streams only (secondary sources, to confirm on Google's docs at build);
   TikTok LIVE and Instagram Live embeds are **not verified** and may not be embeddable — only YouTube is promised until
   each is tested.
8. **Broadcast TV** may be shown in a shop only under the shop's own arrangements; re-streaming it is retransmission
   (Copyright Act s. 31) — we never carry the signal. We show a channel or programme **name** typed by the owner, nothing more.

## Options weighed

| Option | For | Against | Verdict |
| :-- | :-- | :-- | :-- |
| A. Amazon CloudFront only | already a CDN | no ingest, no transcode, no player | refused (does not fit) |
| B. Amazon IVS | managed, low latency, web broadcast SDK, real-time stages | no Canadian region; input billed per hour on top of delivery; AWS account and IAM to run | adapter later if needed |
| C. MediaLive + MediaPackage + CloudFront in ca-central-1 | Canadian processing and origin | assembled pipeline, per-channel hourly cost, operations we don't want | adapter when a client requires it |
| D. Cloudflare Stream Live (our account) | ingest + encoding free, recording off by default, retention by API, signed URLs, RTMPS/SRT | delivery cost scales with viewer-minutes and is too high for a small shop's margin (founder call); US company, no public region choice | **not the default**; the shop may connect **its own** Cloudflare account (BYO), our account stays a switchable managed adapter |
| E. Self-hosted origin: MediaMTX on a small droplet in Toronto + Bunny CDN for HLS | Canadian origin; fixed small compute plus the cheapest per-GB delivery; MIT, trusted OSS behind our port; recording and retention are ours | we run one small server (health, restarts, updates); transcoding to a ladder is our job (start with a single rung or passthrough); no managed SLA | **optional managed service (« we run it for you »), Entreprise only**; not the default |
| F. **Bring your own**: the shop streams on its own YouTube / Facebook / Twitch / Instagram / TikTok live (embed after one click) or with its own Cloudflare Stream / Mux / other account (its keys) | zero cost to us; the shop is controller of its channel; same consent-gated pattern as the short-videos TV | the platform's terms and ads apply; no Law 25 control of the stream; TikTok / Instagram embed of a live to be verified | **chosen: the default**; we store no video, host no stream, keep no recording |
| G. Mux | best-documented latency modes | live input billed per minute; no public region choice | adapter later if needed |
| H. Bunny Stream Live | — | founder: Bunny has no live product for us | **dropped** (Bunny is the CDN only) |
| I. Spotify Web API « now playing » | ambiance on the page | forbidden for in-store business use (finding 4) | **refused** |

## Decision

### 1. One port, `LiveVideo`, in `@krizaka/*` (libs first)

A provider-neutral port next to payments and storage (krizaka-ts), apps never import a provider SDK:

```ts
interface LiveVideo {
  createInput(opts: { shopId: string; recording: "off" | "on"; retentionDays?: number }): Promise<LiveInput>; // RTMPS/SRT URL, stream key (secret), WHIP URL if any
  playback(inputId: string): Promise<{ hls: string; signedUntil?: Date }>;
  status(inputId: string): Promise<"idle" | "live" | "ended">;
  deleteRecording(id: string): Promise<void>;
  handleWebhook(req: Request): Promise<LiveEvent>; // connected / disconnected / recording ready, applied once
}
```

**Default = bring your own**: ONE connector pattern, `externalEmbed` — the shop gives the link of its live, we store only that link and render a click-to-load player from a per-platform table (see « BYO platforms » below) — and the provider adapters driven by the **shop's own keys** (`cloudflareStream`, later Mux or others): the shop is the controller and the payer, nothing runs on our account. **Optional managed service (Entreprise only)**: `selfHostedOrigin` (MediaMTX in Toronto, HLS delivered by Bunny CDN) and our own `cloudflareStream` account. Also `memoryLive()` for tests; IVS, MediaLive (Canada) and Mux only when a need is proven.
The admin console configures the provider and its keys (settings in the database, the source of truth); on the Entreprise
offer a shop may bring its own provider account. Stream keys are secrets: stored encrypted, shown once, rotatable.

#### Live provider screen (admin console)

The admin console has a **« Live provider »** screen, like the payments and storage ones: pick the active adapter
(self-hosted origin, the shop's own YouTube / Instagram / TikTok live, Cloudflare Stream…), enter its keys (stored encrypted
in the database, **never shown back**, replaceable), **test the connection**, and switch **without a redeploy**. On
Entreprise the shop owner can also connect **its own provider account** in its settings (`media.live.ownProvider`), through
the same port. Events are provider-neutral rows, so **switching adapters keeps scheduled events working**: a scheduled event
resolves its adapter when it starts; an event in progress finishes on the adapter it began with.

#### BYO platforms (one connector pattern, terms read 2026-10-30)

| Platform | Embed | Conditions | Status |
| :-- | :-- | :-- | :-- |
| YouTube Live | `youtube-nocookie.com` iframe of the live's video id | public stream; Developer Policies of finding 5; no live chat in the player | first |
| Twitch | `player.twitch.tv/?channel=<name>&parent=<our domain>` — the `parent` parameter is **required** and names every domain that embeds ([Twitch embed docs](https://dev.twitch.tv/docs/embed/video-and-clips/)) | min. 400×300 px; autoplay defaults on (we start only after the click, `muted` off by choice); `parent` = the shop's domains, from our configuration; add `player.twitch.tv` to `EMBED_FRAME_HOSTS` | first |
| Facebook Live | Facebook plugin: the player accepts any **public** live video post by a Page or person, via its JavaScript SDK `fb-video` + `data-href` ([Embedded Video Player](https://developers.facebook.com/docs/plugins/embedded-video-player/)); the `embed_html` iframe is deprecated | public post only; the SDK is a third-party script, so it loads **only after the click**, never on page load; add `facebook.com` frames and `connect.facebook.net` to the CSP | after review |
| Instagram Live / TikTok LIVE | existing `externalReel` hosts | embed of a *live* not verified — shown as a link out until tested | later |

Every platform is one row of one table (`id`, URL pattern → embed URL, CSP hosts, `needsParent`, `loadsScript`); adding one
is data plus a test, not a new component. Each stays behind the click, with our poster before consent.

### 2. Live is an **event**, never an always-on camera

- A live is a `live_event` row: shop, title, starts_at, status (`scheduled · live · ended · cancelled`), recording on/off,
  retention, consent checklist ticked (who, when). It reuses ADR-007's « event » kind when the event is sold (seats).
- The shop page shows a **scheduled** event with a countdown, then the live badge and the player, then the replay if
  recorded. A 24/7 in-store camera is refused (constant filming of staff and clients is surveillance, not a show).
- Playback goes through `@krizaka/ui`'s `VideoPlayer` (captions, keyboard, reduced motion) reading the HLS URL — not the
  provider's iframe — so the page loads no provider script or cookie.

### 3. Law 25 by design ⚖ (Act respecting the protection of personal information in the private sector, CQLR c. P-39.1)

**Roles.** For **bring your own** the shop is the controller of its stream and its recordings and the platform or provider it
chose is its processor; Krizaka only **renders an embed after a click** (and, for provider keys, stores them encrypted) — we
see, store and record no video, so the consent checklist and the notice are the shop's, offered as tools. For the **managed
service** Krizaka is the shop's **processor** and the table below applies to us in full.

| Obligation | Where it lands |
| :-- | :-- |
| Consent of every identifiable person filmed: manifest, free, enlightened, for this purpose (s. 14); minors under 14 only with the consent of the person with parental authority (s. 4.1); image and voice are also protected by the Civil Code of Québec, art. 3 and 36(5), and the Charter of human rights and freedoms, s. 5 | « Go live » cannot start before the owner confirms the consent checklist (staff, guests, clients in frame; no minor without a parent's consent); the confirmation is logged with the event |
| Notice at collection: purposes, recipients, where the data may go outside Québec, rights (s. 8) | a visible « live » notice in the shop (printable sign from the owner console) and on the page next to the player; the shop's privacy notice lists the provider and the location of recordings |
| Highest confidentiality by default (s. 9.1) | recording **off** by default; replay unlisted until the owner publishes it; signed playback URLs for replays |
| Communication outside Québec needs a prior assessment (s. 17) and the processor is bound by a written contract (s. 18.3) | an **EFVP** per provider before its first live, filed with the ADR's slice 0; the Krizaka ↔ provider DPA; Krizaka is the shop's processor in the terms |
| Retention limited to the purpose, then destruction (s. 23) | retention set by the owner (default 30 days, provider minimum 30; shorter is done by our own deletion job); deletion on request from the owner console |
| Person in charge and governance (s. 3.1–3.2) | the shop is the controller of its stream and names its person in charge; Krizaka's own governance policy covers the processing it does |
| No profiling of viewers (s. 8.1) | aggregated counters only (peak viewers, minutes watched); no per-viewer record |
| Chat (later) | moderation, report, delete; not in the first slices |

### 4. « What we play » — an **Ambiance** card written by the owner

- Text the owner types: the style or playlist name, an optional plain link (any service, opens in a new tab), the TV channel
  or programme name. No Spotify, YouTube or TV API; no audio or video carried; no logo of a service on our page.
- The owner screen carries the licence line: « Playing music in your shop needs a public-performance licence (SOCAN +
  Re:Sound, through Entandem) and a business music service; consumer apps such as Spotify are for personal use. »
- Clips tied to the music are short videos (§5), consent-gated like every external clip.

### 5. The short-videos TV comes first on the page

The marketing anchor is the owner's own clips, at the top of the shop page (krizaka/krizaka-internal#1338): our storage,
our player, no per-hour cost. External clips (YouTube, TikTok, Instagram) stay behind one click (`externalReel`, CSP
`EMBED_FRAME_HOSTS`), with our poster before consent.

### 6. Offers are data

Entitlement keys, mapped to plans by the admin (no plan logic in code; the mapping and its numbers are in the internal ADR
issue): `media.shortVideos`, `media.ambiance` (every plan); `media.live.byo` (the shop's own channel or provider account;
it costs us nothing, **which plans get it is decided in krizaka/krizaka-internal#1525, not in this ADR**); and
**`media.live.managed` — Entreprise only** (our origin, with `media.live.events` and a monthly allowance of viewer-minutes,
`media.live.replay`). Plans below Entreprise get **nothing managed**. The allowance is enforced at « Go live » and shown to the owner before the event;
reaching it ends nothing in progress; caps against abuse (concurrent viewers, event length, events per month) are admin
settings.

## Slices (order)

| # | Slice | Surfaces | Depends on |
| :-- | :-- | :-- | :-- |
| 0 | (managed service only) EFVP for the first provider + privacy-notice and terms lines (processor) ⚖ | docs, legal pages | — |
| 1 | Short-videos TV redesign in krizaka-ui, then at the top of the shop page (krizaka/krizaka-internal#1338) | web (page), mobile web | — |
| 2 | `LiveVideo` port + **BYO connectors** (`externalEmbed`: YouTube and Twitch first, Facebook once its SDK path is accepted, TikTok / Instagram once tested; `cloudflareStream` with the shop's own keys) + `memoryLive` in krizaka-ts | lib | — |
| 2b | **« Live provider » admin screen first**: choose adapter, encrypted keys, connection test, switch without redeploy; the shop owner connects its own account or channel in its settings. Tests: switching adapters keeps scheduled events working; keys never returned by the API | admin, owner console | 2 |
| 3 | `live_event` model + scheduled event with countdown on the shop page (BYO player after a click) | web, owner console | 2b |
| 4 | « Go live » in three taps on a phone (owner console: browser WebRTC where supported, RTMPS/SRT details for OBS), consent checklist, in-shop sign | owner web, mobile app (opens the console), admin | 3 |
| 5 | Replay: recording on/off, retention, deletion, signed URLs | web, owner console | 4 |
| 6 | Ambiance card + the licence line | web, owner console | — |
| 6b | **Managed service** (Entreprise): `selfHostedOrigin` (MediaMTX Toronto + Bunny CDN), go-live, recording and retention, deletion job, EFVP | admin, owner console, infra | 0, 5 |
| 7 | Entitlements: `media.*` keys enforced, `media.live.managed` Entreprise only (after ADR-008) | admin, owner console | ADR-008 |

Mac: n/a (the owner console in the window). Each slice ships its journey (e2e), both themes, EN/FR.

## Consequences

- No third-party audio or video API sits between a shop and its visitors unless the shop chose it and the visitor clicked.
- **Less responsibility for us, more flexibility for the shops**: by default the shop streams with its own account (YouTube, Facebook, Twitch, Instagram, TikTok, or its own provider keys), is the controller and the payer; we host no stream, store no video and keep no recording. Our cost for the default is about nothing.
- The **managed service** (our Canadian origin, Bunny CDN delivery) is an Entreprise-only « we run it for you » offer; its
  figures are in krizaka/krizaka-internal#1339 and the price is set in #1525. We then operate one small server (monitoring,
  restarts, updates, a recording-deletion job) and become the shop's processor; recordings stay in Canada, viewers are served
  through CDN edge nodes and the notice says so.
- Providers can be changed in the admin console without a redeploy; scheduled events survive a switch.
- Law 25 for the managed service is as in section 3; for BYO the shop's own consent and notice apply and we ship the tools.
- Refused for good: Spotify « now playing », YouTube as background audio, re-streaming TV, always-on cameras.

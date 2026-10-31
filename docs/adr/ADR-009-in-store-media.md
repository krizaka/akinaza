# ADR-009 — In-store media: live events behind a streaming port, the short-videos TV first, « what we play » without third-party APIs

Status: **accepted** (CTO, 2026-10-30), **amended 2026-10-30** after the founder's final call: live = the shop's own YouTube / Facebook (Instagram, TikTok, Twitch where embeddable) live, shown on its page after a click. We host, store and record nothing; there is no live offer to price. Figures that led here are in the private issue (no prices in this repository). Issue: krizaka/krizaka-internal#1339 (ADR). Orientation: the written marketing × UX
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
| D. Cloudflare Stream Live | ingest + encoding free, recording off by default, retention by API, signed URLs | delivery is billed per viewer-minute: too expensive for a small shop's margin (founder call); US company, no public region choice | **rejected: cost** |
| E. Self-hosted origin: MediaMTX on a droplet in Toronto + Bunny CDN | Canadian origin, cheapest per GB, MIT OSS | a server to run, transcoding, recordings and Law 25 processor duties on us, for a feature that earns nothing | **rejected: operations and responsibility** |
| F. **The shop's own live, embedded**: YouTube, Facebook, (Instagram, TikTok, Twitch where embeddable), shown after one click | costs us nothing; we host, store and record nothing; the platform is the controller of the stream; same consent-gated pattern as the short-videos TV | the platforms' terms apply; no control of the stream | **chosen** |
| G. Mux | best-documented latency modes | live input billed per minute; no public region choice | rejected: cost |
| H. Bunny Stream Live | — | founder: Bunny has no live product for us (Bunny stays our CDN) | dropped |
| I. Spotify Web API « now playing » | ambiance on the page | forbidden for in-store business use (finding 4) | **refused** |

## Decision

### 1. One connector pattern, `LiveEmbed`, in `@krizaka/*` (libs first)

We carry **no stream**. A shop streams on its own platform; Krizaka stores only the **link** of that live (or the connected
account's id) and renders it. One data table, one component, no provider SDK in apps:

```ts
interface LiveEmbed {
  platform: "youtube" | "facebook" | "twitch" | "instagram" | "tiktok";
  parse(url: string): { embedUrl: string; needsParent?: boolean; loadsScript?: boolean } | null; // null = not a live link of this platform
  isLive?(ref: string): Promise<boolean>; // optional « live now » detection when the account is connected
}
```

Adding a platform is a row (`id`, URL pattern → embed URL, CSP hosts, `needsParent`, `loadsScript`) plus a test, never a new component.

| Platform | Embed | Conditions | Status |
| :-- | :-- | :-- | :-- |
| YouTube Live | `youtube-nocookie.com` iframe of the live's video id | public stream; Developer Policies of finding 5; no chat in the player | first |
| Facebook Live | Facebook plugin: any **public** live post by a Page or person, JavaScript SDK `fb-video` + `data-href` ([Embedded Video Player](https://developers.facebook.com/docs/plugins/embedded-video-player/)); the `embed_html` iframe is deprecated | public post only; the SDK is a third-party script, loaded **only after the click**; CSP adds `facebook.com` and `connect.facebook.net` | first |
| Twitch | `player.twitch.tv/?channel=<name>&parent=<our domain>` — `parent` required ([Twitch embed docs](https://dev.twitch.tv/docs/embed/video-and-clips/)) | min. 400×300 px; autoplay defaults on, we start only after the click; CSP adds `player.twitch.tv` | when the shop asks |
| Instagram Live / TikTok LIVE | existing `externalReel` hosts | embed of a *live* not verified — a link out until tested | later |

### 2. The page shows the live at that moment

- The owner **pastes the link** of its live (or connects its account so « live now » is detected, where the platform allows
  it). A `live_event` row holds: shop, platform, link, title, starts_at, status (`scheduled · live · ended`).
- The shop page shows a **scheduled** event with a countdown, then a **live badge** and our poster; the platform's player
  loads **only after the visitor's click**, and goes away when the event ends. Replays are the platform's, not ours.
- Admin settings (database, the source of truth): each platform **on/off**, so a platform can be switched off for every shop
  without a redeploy.

### 3. Law 25 ⚖ (CQLR c. P-39.1)

- **The platform is the controller of the stream**, and the shop is responsible for whom it films (consent of identifiable
  people, s. 14; minors under 14 only with a parent's consent, s. 4.1; Civil Code art. 3 and 36(5)). Krizaka hosts, stores
  and records **no video** and sees no viewer: we only **render an embed after the visitor's consent** (the click).
- The click is the consent for the platform's player and cookies; before it, no third-party script or cookie loads. A notice
  next to the player names the platform and links its privacy policy (s. 8).
- The owner console offers tools, not obligations on us: a consent checklist the shop may tick before announcing a live and a
  printable in-shop « we are live » sign.
- No profiling: we keep no per-viewer record. Our own privacy page says the page can show a platform's live after a click.

### 4. « What we play » — an **Ambiance** card written by the owner

- Text the owner types: the style or playlist name, an optional plain link (any service, opens in a new tab), the TV channel
  or programme name. No Spotify, YouTube or TV API; no audio or video carried; no logo of a service on our page.
- The owner screen carries the licence line: « Playing music in your shop needs a public-performance licence (SOCAN +
  Re:Sound, through Entandem) and a business music service; consumer apps such as Spotify are for personal use. »
- A live that carries recorded music is the shop's licence matter on its platform ⚖ (finding 6).

### 5. The short-videos TV comes first on the page

The marketing anchor is the owner's own clips, at the top of the shop page (krizaka/krizaka-internal#1338): our storage, our
player, no per-hour cost. External clips and lives (YouTube, Facebook, TikTok, Instagram, Twitch) stay behind one click, with
our poster before consent.

### 6. Entitlements

`media.shortVideos`, `media.ambiance`, `media.liveEmbed` — mapped to plans by the admin (no plan logic in code). It costs us
nothing, so there is no allowance, no overage and no price to design.

## Slices (order)

| # | Slice | Surfaces | Depends on |
| :-- | :-- | :-- | :-- |
| 1 | Short-videos TV redesign in krizaka-ui, then at the top of the shop page (krizaka/krizaka-internal#1338) | web (page), mobile web | — |
| 2 | `LiveEmbed` table + parsers (YouTube, Facebook first) + CSP hosts, with tests (a live link of each platform parses; a non-live link is refused) | lib, web | — |
| 3 | `live_event` model, owner console form (paste the link, title, date), scheduled event with countdown, live badge, click-to-load player; admin settings: platform on/off | web, owner console, admin | 2 |
| 4 | « Live now » detection for connected accounts where the platform allows it; Twitch (`parent`), then Instagram / TikTok once tested | web, owner console | 3 |
| 5 | Ambiance card + the licence line | web, owner console | — |
| 6 | Entitlements `media.*` enforced (after ADR-008) | admin, owner console | ADR-008 |

Mobile app: opens the owner console. Mac: n/a (the owner console in the window). Each slice ships its journey (e2e), both themes, EN/FR.

## Consequences

- No video passes through Krizaka: nothing to host, record, retain or delete, no processor duties for streams, no cost per
  viewer, no provider to operate. The feature is free to run.
- Third-party audio or video reaches a visitor only when the shop chose the platform and the visitor clicked.
- The quality and availability of a live depend on the platform; the page shows the countdown and badge, the platform plays.
- The rejected managed options (Cloudflare, our Toronto origin, Mux, IVS, MediaLive) stay documented above with their cost as
  the reason; if a client one day needs a managed live, it is a new ADR.
- Refused for good: Spotify « now playing », YouTube as background audio, re-streaming TV, always-on cameras.

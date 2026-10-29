# ADR-005 — Shop addresses: the app on akinaza.com, the shops on their own domain, custom domains, and isolation

Status: **proposed** (2026-10-29). Issue: krizaka/akinaza#77 (Feature, under the Dev preview epic #52). Slices: the
sub-issues of #77 listed at the end. Reuses the configured-origin rule of `@krizaka/auth` 0.13 (`landingRedirect({ origin })`).

## Context

- Merchants want their own address: a custom slug, a short host, and later their own domain (#77). Level 1 (editable slug,
  former slugs answer 308, `shop_former_slugs`) and level 2 (`<slug>.akinaza.com`, wildcard on App Platform, `noindex`)
  are live since 2026-10-22. Level 3 (the merchant's own domain) is parked.
- The founder pasted a security analysis and asks « est-ce une bonne direction ? ». Its thesis: never host merchant
  content on the brand's main domain; a dedicated wildcard domain for shops (like `*.myshopify.com`, `*.vercel.app`);
  merchants' own domains through a TLS-per-hostname service (Cloudflare for SaaS, or Caddy with a locked validation
  endpoint); `__Host-` cookies; reserved and anti-phishing slugs; strict Host validation with an existence check; a strict
  CSP; server-side sanitising.

### How shops are served today (main, 2026-10-29)

| Piece | Today | Where |
| --- | --- | --- |
| Shop page | `www.akinaza.com/{locale}/s/{slug}` and `{slug}.akinaza.com` (rewrite to the same page), `published = true` only | `apps/web/proxy.ts`, `lib/host.ts` `shopOfHost`/`routeFor`, `packages/db` `publicShop` |
| Signed-in app, studio, admin console | the same origin `www.akinaza.com`; the console on `admin.akinaza.com` (same app, host-routed, IP-gated) | `lib/host.ts`, `deploy/digitalocean/app.yaml` |
| Session cookie | `akinaza_session`: HttpOnly, `Secure` in production, `SameSite=Lax`, `Path=/`, no `Domain` (host-only). **No prefix.** | `apps/web/lib/session.ts` |
| Locale cookie | `NEXT_LOCALE`, `SameSite=Lax`, no `Secure`, no prefix | `proxy.ts` |
| CSP | one policy for every route: `script-src 'self' 'unsafe-inline'`, `frame-ancestors 'self'`, `form-action 'self'`, `object-src 'none'`, embeds only after a click | `apps/web/next.config.mjs` |
| CSRF | no Origin / `Sec-Fetch-Site` check on the API routes; `SameSite=Lax` is the only barrier (Server Actions have Next's own Origin check) | — |
| Owner content | structured only: zod-validated texts rendered by React (escaped), sections from an enum, `https://` images limited by `img-src` to this origin and the media CDN, social links bound to their platform's host (`socialLink`). **No raw HTML, Markdown, custom CSS, script, pixel or tracker.** | `packages/db/src/shop-page.ts`, `shop-community.ts` |
| Host handling | `shopOfHost` checks the form and a reserved list, **not that the shop exists**; the proxy's `redirect` case builds `${x-forwarded-proto}://${Host}` | `proxy.ts` |
| Reserved names | two lists: `RESERVED_SLUGS` (core) for slugs, `PLATFORM_HOSTS` (= that list + `mail`, `cname`, `cdn`, `static`, `status`, `staging`) for hosts: a shop can take the slug `status` but never gets its host | `packages/core`, `lib/host.ts` |

### The risks of today's setup

1. **Same origin as the signed-in app.** A shop page is served from `www.akinaza.com`, the origin of the session, the
   studio and the books. An injection in a shop page (a future rich-text field, a JSON-LD block, a dependency bug) is a
   script on the app: it reads the CSRF-free API with the owner's or a customer's session. `script-src 'unsafe-inline'`
   turns any HTML injection into script execution.
2. **Same site as the app, the console and every other shop.** `*.akinaza.com` shops, `www` and `admin` share the
   registrable domain `akinaza.com`. `SameSite=Lax` does not stop a request from `x.akinaza.com` to `www` (same-site),
   and a script on any `*.akinaza.com` host can **toss** a cookie with `Domain=akinaza.com` that `www` will receive
   (session fixation, login CSRF): only a `__Host-` name forbids that.
3. **Phishing under our name.** Any well-formed slug becomes `<slug>.akinaza.com` with a valid certificate and our brand
   in the bar (`desjardins-connexion.akinaza.com`). The reserved list holds platform words, no brands, no « login /
   verify » terms. One phishing shop can get **akinaza.com itself** listed by Safe Browsing — the app included.
4. **Host trusted for absolute URLs** (the proxy's redirect case) and no existence check (every random subdomain renders
   the 404 through the app and the database).

None is an incident: owner content is structured and escaped. They are **architectural** risks that grow with each
feature that lets an owner write more.

## Verdict on the analysis

**Good direction.** It is the standard of every platform that hosts user pages (GitHub Pages moved to `github.io` in 2013
for exactly this; `myshopify.com`, `vercel.app`, `netlify.app` are on the Public Suffix List). Checked point by point:

| Point of the analysis | Verdict | Source / note |
| --- | --- | --- |
| Never host merchant content on the brand's main domain | **Right** — and today we do (risks 1–2) | OWASP Cross-Site Scripting Prevention Cheat Sheet; GitHub's 2013 `github.io` move |
| A dedicated wildcard domain for shops | **Right** | App Platform already serves a wildcard (level 2): the same mechanism on a new domain |
| **Public Suffix List** | **Missing from the analysis.** A separate domain separates shops from the app (different site), but **not shops from each other**: `a.shops.tld` and `b.shops.tld` stay same-site until the domain is in the PSL's private section | publicsuffix.org; MDN *Glossary: Site* (site = scheme + registrable domain, from the PSL). **Caveat:** the PSL guidelines refuse « small, temporary, test, sandbox or beta projects, especially those serving only a few thousand users », require a `_psl` TXT record and ≥ 2 years of registration, and browsers pick it up over months. So: **design so that we are safe without it** (no cookie of value on the shop domain), submit when eligible. |
| Own domains through a TLS-per-hostname service | **Right** | Cloudflare for SaaS: 100 custom hostnames included on Free/Pro/Business, then **0.10 $ US per hostname per month**; Free has no apex proxying and no wildcard custom hostnames (merchants use a subdomain like `reservation.monsalon.ca`, or a DNS that flattens a CNAME at the apex) |
| Caddy with on-demand TLS + `ask` endpoint | **Right as the alternative** | Caddy docs, `on_demand_tls { ask }`: the endpoint must answer 200 only for a verified, active domain, or anyone pointing a name at us burns our Let's Encrypt quota (50 certificates per registered domain per 7 days, 300 orders per account per 3 h, 5 failed validations per identifier per hour; ARI renewals exempt) |
| `__Host-` cookies | **Right** | MDN Set-Cookie: `__Host-` requires `Secure`, `Path=/`, no `Domain` — the cookie cannot be set by a sibling host nor scoped to the parent domain. `__Host-Http-` (adds HttpOnly-only) is newer; adopt it when every browser we support honours it |
| Reserved / anti-phishing slugs | **Right, incomplete today** (risk 3) | — |
| Strict Host validation + existence check | **Right**, with a short cache (a random-subdomain flood must not reach the database each time) | OWASP *Host header injection*; our `@krizaka/auth` 0.13 rule: absolute URLs from a **configured** origin, never from `Host` / `X-Forwarded-*` |
| Strict CSP | **Right**: nonce-based (`'strict-dynamic'`), not an allow-list with `'unsafe-inline'` | OWASP CSP Cheat Sheet; web.dev *Strict CSP* |
| Server-side sanitising | **Does not apply today** (no HTML input). Becomes a rule: the day a rich field arrives it is an allow-list sanitiser on the server (trusted open source behind a `@krizaka/*` facade), never a blocklist | OWASP XSS Prevention |
| Also missing | **CSRF check** (Origin / `Sec-Fetch-Site`) on unsafe methods; **JSON-LD escaping** (`JSON.stringify` does not escape `</script>`); **custom-domain takeover** (a domain is re-verified each time it is attached, never inherited); **cache key by host** and no shared caching of HTML; **Safe Browsing blast radius** (a separate domain protects the app's reputation) | OWASP CSRF Prevention Cheat Sheet (Fetch Metadata) |
| Does not apply | trackers / pixels / owner scripts: refused by design, not filtered | — |

## Decision

### 1. Domains

| Surface | Host | Cookies of value |
| --- | --- | --- |
| Marketing, sign-in, the app, the studio, booking confirmation | `www.akinaza.com` (apex 308 → www) | the session |
| Administration console | `admin.akinaza.com` (IP-gated, as today) | its own host-only session |
| Shops | `<slug>.akinaza.shop` (wildcard), and later the merchant's own domain | **none** |
| Development | `dev.akinaza.com` (as today) | — |

- **The shop domain is `akinaza.shop`** (decided 2026-10-29: the founder bought it at Porkbun; DNS and deploy set up in
  slice 5, not before). Shops answer on `<slug>.akinaza.shop`. A separate registrable name (not `shops.akinaza.com`) is
  the point: a different registrable domain is a different site. `akinaza.shop` itself (apex and `www`) 308s to
  `www.akinaza.com`. The other candidates weighed (`akinaza.page`, HSTS-preloaded TLD; `akinaza.site`) are not taken.
- **`*.akinaza.com` stops being a shop address.** Its wildcard is removed from the App Platform spec once the shop domain
  serves; `<slug>.akinaza.com` answers 308 to `<slug>.akinaza.shop` while the wildcard lasts (a few months, for the
  addresses already shared), then the wildcard goes and only named hosts remain.
- **Booking stays a hop to the app.** The shop domain shows the shop, its services and its free times (anonymous, as
  today). Confirming (sign-in at the last step) is a top-level navigation to `www.akinaza.com/{locale}/book/…` with the
  choices in the URL; the session cookie never exists on a shop host. The studio's preview of a draft stays on the app
  (authenticated); the published page lives on the shop domain.
- **PSL plan** (the design holds without it, because the shop domain carries no credential):
  1. Extend `akinaza.shop`'s registration to **several years** first (renewal ≈ 31 $ US/year at Porkbun): the guidelines
     want ≥ 2 years left at submission and > 1 year kept at all times, else the entry is removed.
  2. Open the PR on `publicsuffix/list` adding `akinaza.shop` to the **private section** (organisation « Krizaka », a
     rationale: user-controlled subdomains `<slug>.akinaza.shop`, cookie and site isolation between merchants, the
     abuse contact), submitted by Oussama as the domain owner's representative.
  3. Add the `_psl.akinaza.shop` TXT record `https://github.com/publicsuffix/list/pull/<n>` and **never remove it**.
  4. Timing: when Akinaza serves real merchants. The guidelines refuse small, test or beta projects; a refusal now
     would cost the re-submission. Until merged and shipped by browsers (months), shops are same-site with each other.

### 2. Custom slugs

- Form: `^[a-z0-9]+(-[a-z0-9]+)*$`, 3–40 characters (one DNS label, ≤ 63; 40 keeps it printable), ASCII only (no
  punycode, so no homograph).
- **One reserved list** in `@akinaza/core`, read by the slug schema **and** the host router (today's two lists merge):
  platform words (`www`, `app`, `api`, `admin`, `dev`, `mail`, `cname`, `cdn`, `static`, `status`, `staging`, `s`, `en`,
  `fr`, `es`, `report`, `sign-in`, `sign-up`, `help`, `support`, `billing`, `legal`, `akinaza`, `krizaka`, `orazaka`…).
- **Anti-phishing**, data in the database (the administrator edits it; settings are the source of truth): a list of
  protected brands and institutions (banks, payment networks, governments, big platforms — e.g. `desjardins`, `interac`,
  `paypal`, `revenu-quebec`, `canada`, `gouv`) and of lure terms (`login`, `signin`, `verify`, `secure`, `account`,
  `password`, `wallet`, `update`). A slug **containing** one (after folding look-alike digits: `0→o`, `1→l`, `3→e`,
  `5→s`) is not refused silently: it is **held for review**, the shop stays on its default slug until an administrator
  approves.
- **A shop is public only once published and its owner verified** (verified email today; the reviewed slug when flagged).
  An unpublished or suspended shop is a 404 on every host.
- A slug change is limited (e.g. 3 per 30 days, a setting) and a former slug is **never given to another shop** while it
  redirects (`shop_former_slugs`, as today; at least 12 months, printed flyers).

### 3. Custom domains (level 3)

- **Ownership first, TLS second.** The merchant adds `reservation.monsalon.ca`; we show a TXT record
  `_akinaza-verify.reservation.monsalon.ca = <random token per shop and domain>` and a CNAME to
  `edge.akinaza.shop`. The domain is `pending` until the TXT matches; it is re-checked periodically, and **re-verified
  each time it is attached to a shop** (a domain released by one shop is never inherited by another: no dangling takeover).
- **TLS per hostname: Cloudflare for SaaS** (recommended): the shop domain's zone on Cloudflare, a fallback origin to the
  App Platform app, custom hostnames created by API behind a port (`CustomHostnames` in `packages/core`, the Cloudflare
  adapter in `packages/db` or a small package; the vendor is a value, never a name in the domain code). Cost: 0 $ up to
  100 domains, then 0.10 $ US/month each. To prove in the first slice of level 3 (a spike): App Platform accepts a request
  whose `Host` is a custom hostname it does not list (App Platform is itself behind Cloudflare: the Cloudflare-to-Cloudflare
  path must be tested), else a Worker forwards to `<slug>.akinaza.shop` with a signed header.
- **Alternative: Caddy** on a small Droplet (≈ 6–12 $ US/month), on-demand TLS whose `ask` endpoint answers 200 only for an
  `active` domain, reverse-proxying to the app. Cheaper at scale, but we then own TLS, renewals, DDoS and one more machine.
  Kept as the fallback if the spike fails or the bill grows past ~1,000 domains.
- **App Platform alone** (each domain in the spec, up to 500 per app) is refused: every domain is a spec change and a
  redeploy, against « the live spec equals the repository file ».
- **No shared caching of HTML** on custom or shop hosts (`Cache-Control: private, no-store` on pages; static assets keep
  their hashed, immutable caching). The cache key always includes the host.

### 4. Cookies

- App: `__Host-akinaza_session` (HttpOnly, Secure, `Path=/`, `SameSite=Lax`), `__Host-NEXT_LOCALE`. The console:
  `SameSite=Strict`. Renaming signs everyone out once (acceptable in Dev preview).
- **No `Domain=` attribute anywhere**, ever. Development over plain http keeps the names without prefix
  (`__Host-` requires Secure), behind one function that names cookies.
- Shop hosts: no session, no tracker; at most a host-only `__Host-` preference (language) for that shop alone.
- **CSRF**: unsafe methods on `/api/*` require `Sec-Fetch-Site: same-origin` (or an `Origin` equal to the configured app
  origin when the header is absent). This also closes risk 2 before any domain moves.

### 5. Host validation

- One module decides, in this order: the configured app hosts (exact, from env: www, admin, dev); `<label>.akinaza.shop`
  where the label passes the slug form **and** a published shop has it; an `active` custom domain from `shop_domains`.
  Existence is read through a short in-memory cache (positive and negative, ~60 s; a suspension takes effect within it).
  Anything else: **421 Misdirected Request** (or 404), rendered without the database.
- **Never build an absolute URL from `Host` or `X-Forwarded-*`**: redirects and canonicals use the configured app origin
  (`@krizaka/auth` 0.13's `origin`) or the shop's canonical origin read from the database. The proxy's redirect case changes.

### 6. CSP per surface

- **Shop hosts**: `default-src 'none'`; `script-src 'nonce-…' 'strict-dynamic'` (no `'unsafe-inline'`; shop pages are
  dynamic already, so a per-request nonce costs no static page); `style-src 'self' 'unsafe-inline'` (styles cannot run
  code); `img-src`/`media-src` this origin + the media CDN; `connect-src 'self'`; `form-action 'self' https://www.akinaza.com`;
  `frame-ancestors https://www.akinaza.com` (the studio's preview) else `'none'`; `base-uri 'none'`; `object-src 'none'`.
- **App**: today's policy, then the same nonce move; `frame-ancestors 'self'`.
- **Console**: the strictest (`frame-ancestors 'none'`, no embeds).
- Embeds (TikTok, YouTube, Instagram) stay behind a click, in `frame-src` only.

### 7. Owner content

- Structured fields only, escaped by React; no raw HTML, Markdown, custom CSS, script, pixel, analytics tag or iframe
  from an owner — refused by design. Links: `https://` and bound to a known host (as `socialLink` does).
- JSON-LD that carries owner data goes through one helper that escapes `<`, `>`, `&`, U+2028/U+2029.
- The day a rich-text field is wanted: an allow-list sanitiser on the server, a trusted open-source project behind a
  `@krizaka/*` facade, with its own ADR.

### 8. Rate limits, abuse, takedown

- Rate limits on slug availability checks, slug changes, domain additions (e.g. 5 domains per shop, a setting) and
  verification retries.
- Every shop page carries « Report this page » (new: a short form to the app's API, not the walk-report `/report/[token]`);
  a report reaches the console's queue.
- **Takedown**: the console suspends a shop → `published = false`, its custom domains `suspended` (hostname removed from
  the TLS service); every host stops answering within the cache TTL. The shop domain has its own abuse contact and
  Safe Browsing monitoring (Search Console on the shop domain).

### 9. Migration and SEO

- `www.akinaza.com/{locale}/s/{slug}` → **308** `https://{slug}.akinaza.shop/{locale}` (path and query kept), the same
  for `/service/…` and `/slots`; `{slug}.akinaza.com` → 308 the same. The booking hop keeps its own app path.
- **One canonical per shop**: its active custom domain if any, else its shop-domain host; every other address 308s to it.
  Shop pages stay `noindex` until the founder opens them to search (then sitemap per shop host, hreflang en/fr/es).

## What needs Oussama

1. ~~Buy the shop domain~~ — done: `akinaza.shop` (2026-10-29). Still his: extend its registration to several years
   (≈ 31 $ US/year) before the PSL submission.
2. **Cloudflare**: move `akinaza.shop`'s DNS to Cloudflare and enable Cloudflare for SaaS (0 $ up to 100 custom domains, then
   0.10 $ US/month each) — or choose the Caddy fallback.
3. Approve the brand / lure-term list's first content and who reviews held slugs.
4. Later: the PSL submission (his name as the domain owner's representative).

Slices 1–4 below need none of this and close today's risks on today's hosts.

## Consequences

- The app's origin never serves owner content; a shop bug cannot reach a session. Phishing on a shop no longer threatens
  `akinaza.com`'s reputation.
- Booking adds one top-level hop to the app (the sign-in was already at the last step).
- Until the PSL, shops are same-site with each other; harmless because the shop domain holds no credential.
- One more domain to renew and monitor; one vendor (Cloudflare) for level 3, behind a port.

## Slices (sub-issues of #77), security first

1. #534 — `__Host-` cookies + no `Domain=` + CSRF Fetch-Metadata check on `/api` — today's hosts. Guard: unit test on the cookie
   factory, an ast-grep rule (no `domain:` in a cookie set, cookie names through the factory), a CI check that crawls app
   and shop routes and fails on any `Set-Cookie` without the prefix or with `Domain=`, and an API test refusing a
   cross-site POST.
2. #535 — Strict CSP on shop routes (nonce, `'strict-dynamic'`, `frame-ancestors`), JSON-LD helper. Guard: a test that fails on
   a shop route without the policy or with `'unsafe-inline'` in `script-src`; ast-grep on `JSON.stringify` inside
   `dangerouslySetInnerHTML`.
3. #536 — Host validation module (allow-list + existence + cache, 421), absolute URLs from the configured origin only, one
   reserved list. Guard: spoofed-`Host` tests; a test that the slug list and the host list are the same object.
4. #537 — Anti-phishing slugs (DB list, folding, held for review), publication gate, slug-change rate limit, takedown path.
   Guard: table tests of the folding and the hold.
5. #538 — `akinaza.shop` setup (when we implement, not now): DNS (Porkbun or Cloudflare per decision 2; `*` and apex records,
   App Platform's TXT validation for the wildcard certificate), the domain and its wildcard in
   `deploy/digitalocean/app.yaml`, `APP_SHOP_DOMAIN` declared in `lib/env.ts`, the booking hop, 308 migration,
   canonicals, then removal of `*.akinaza.com`. Guard: redirect table test, the seo-family check per host.
6. #539 — Custom domains (after the Cloudflare decision): spike on App Platform + Cloudflare for SaaS, `shop_domains`, TXT
   ownership, the `CustomHostnames` port, the console's view, no-store HTML. Guard: state-machine tests, takeover test.
7. #540 — PSL submission (`_psl` TXT + the `publicsuffix/list` PR, after the multi-year renewal) — Incubation until eligible.

## Sources

- OWASP Cheat Sheets: Cross-Site Scripting Prevention, Content Security Policy, Cross-Site Request Forgery Prevention
  (Fetch Metadata), Session Management; OWASP WSTG « Testing for Host Header Injection ».
- MDN: `Set-Cookie` (cookie prefixes `__Secure-`, `__Host-`, `__Http-`, `__Host-Http-`; host-only cookies; `SameSite`),
  Glossary « Site ».
- Public Suffix List: publicsuffix.org and its submission guidelines (github.com/publicsuffix/list/wiki/Guidelines).
- Cloudflare for SaaS: developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/ (plans page: 100 hostnames
  included, 0.10 $ each beyond, Free-plan limits).
- Let's Encrypt rate limits: letsencrypt.org/docs/rate-limits/.
- DigitalOcean App Platform limits: docs.digitalocean.com/products/app-platform/details/limits/ (500 domains per app).
- Caddy: caddyserver.com/docs/automatic-https#on-demand-tls.
- web.dev « Mitigate cross-site scripting (XSS) with a strict Content Security Policy ».

> Decision (CTO, 2026-10-29, reversible, #537): the protected-terms list is seeded with the Krizaka family names, the reserved technical words and the lure words; third-party brands are left out and added by the admin in the console when there is a reason.

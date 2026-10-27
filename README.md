<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/akinaza-dark.svg">
    <img src=".github/assets/akinaza-light.svg" alt="Akinaza" width="96">
  </picture>
</p>

# Akinaza

**Run your shop, for less.** The all-in-one for independent Québec shops — hair and beauty salons, studios, consultants, freelancers:
bookings, client files with consent noted by purpose, bilingual invoices with GST 5 % and QST 9.975 %, a tax ledger, and the
GST/QST return **prepared** for the merchant to review and file.

[![CI](https://github.com/krizaka/akinaza/actions/workflows/ci.yml/badge.svg)](https://github.com/krizaka/akinaza/actions/workflows/ci.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/krizaka/akinaza/badge)](https://scorecard.dev/viewer/?uri=github.com/krizaka/akinaza)
[![License: FSL-1.1-ALv2](https://img.shields.io/badge/license-FSL--1.1--ALv2-blue.svg)](LICENSE.md)
[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=krizaka_akinaza&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=krizaka_akinaza) [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=krizaka_akinaza&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=krizaka_akinaza) [![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=krizaka_akinaza&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=krizaka_akinaza) [![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=krizaka_akinaza&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=krizaka_akinaza) [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=krizaka_akinaza&metric=coverage)](https://sonarcloud.io/summary/new_code?id=krizaka_akinaza)

Akinaza (商い *akinai*, trade) is a Krizaka product **in development**: nothing is deployed, sign-up is closed. The
know-how it shows: **running a shop, for less** — one tool instead of five, bookings to taxes prepared.

## What is built

- **Taxes to the cent** — money is integer cents; GST and QST are computed once on the taxable subtotal and rounded half
  away from zero (zero-rated lines stay at zero; a small supplier charges nothing). Tested on known invoices.
- **A ledger that balances** — every invoice posts its GST and QST to an append-only ledger; the database checks at
  commit that the lines make the subtotal and the ledger holds exactly the invoice's taxes. A correction is a credit note.
- **Send an invoice** — the shop queues bilingual invoice e-mails through the outbox. Every send gets a private, expiring
  link whose SHA-256 hash is stored; the page shows the invoice and payment balance, and opening is recorded without a pixel.
  Client erasure revokes the links. PDF download uses the browser's print stylesheet. The daily send limit per shop is an
  audited database setting (`limits.invoiceEmailsPerShopPerDay`, 50; 1–10000), changed in the admin configuration; the
  sender address is the deployment's (`MAIL_*`), a shop only chooses the display name.
- **"Prepare my tax return"** — the FPZ-500 figures (lines 101, 103/106/109, 203/206/209) from the ledger, with their
  working papers; **Akinaza
  prepares; the merchant files.** Nothing is transmitted to any government.
- **Bookings** — services, staff, schedules; the database refuses a double booking (`EXCLUDE` on time ranges).
- **The shop page in other languages** — the owner writes in French or English and offers the page in the languages they choose, inside the
  administrator's list (`storefront.languages.allowed`; `/fr`, `/en` and `/es` under `/s/<slug>`, a language that is off shows the source language).
  Each text is translated automatically through Orazaka (the `TranslationPort`, the Studio `text-translation`), stored with its status (`auto` or
  `edited`), its run and the version of its source, and edited by the owner on « Langues de votre page »; an edited text is never overwritten, a changed
  source flags the translation « à revoir ». Admin: `features.storefrontTranslation` (off until the Studio is wired) and `limits.translationsPerShopPerDay`.
- **Proposed images** — no section of a shop page is ever empty: each trade (salon, coaching, workshop, cleaning, pets, consulting) has neutral default
  photos, a cover with its silent loop and service images on the media CDN (`site/products/akinaza/defaults/`, named by `apps/web/lib/default-media.manifest.json`).
  The owner picks them in « Images proposées » or turns them off; a slot they filled is never replaced; the administrator chooses which trades are offered.
- **Page templates** — two per trade, versioned data (order, variants, hue, paper, text styles), never a text or a photo: the owner picks one in « Apparence » with a
  preview, or at shop creation (the trade's default preselected); a page the owner reordered is asked « keep my order » before anything moves; a template that
  improves ships as a new version, « update available » in the picker, the page unchanged until the owner updates. The demo shops each wear one of their trade. Admin:
  `features.storefrontTemplates`, `storefront.templates.offered`, `storefront.templates.default.<trade>`.
- **Live storefront** — team states and free times refresh from the shop's slots channel while the page is visible.
  SSE carries only a slots-changed signal, never booking details; without it, the visit-time render remains.
  Audited database settings in the admin configuration control `realtime.storefront.enabled` (default `true`),
  `realtime.storefront.heartbeatSeconds` (15; 5–60) and `realtime.storefront.maxStreamsPerPage` (100; 1–1000 concurrent
  streams per shop page per server instance). Streams reconnect within five minutes to reread settings; no rebuild is needed.
- **Consent and erasure** — consent per purpose, append-only; erasure blanks personal data and keeps the invoices tax law requires.
- **Other calendars** — the owner's Google, Outlook, iCloud/CalDAV or ICS calendars are read, busy times only, to keep those slots free of bookings (ADR-004). Google asks for `calendar.freebusy`, Microsoft for `Calendars.ReadBasic` + `offline_access`; the grants are sealed at rest and revoked on disconnection. Each provider is a flag in the administration, off by default, and needs its OAuth client (`AUTH_CALENDAR_GOOGLE_CLIENT_ID`/`_SECRET`, `AUTH_CALENDAR_OUTLOOK_CLIENT_ID`/`_SECRET`).
- **Accounts** — sign-in, "forgot password" with one-use 30-minute links (the answer is the same for every address), a password change that ends the other sessions, a profile with Krizaka's default picture; registration is built and closed by configuration (`AUTH_SIGNUP_ENABLED`).
- **Not for restaurants, cafés, bars and bakeries with on-site consumption** — they must use a sales recording system certified MEV-WEB by Revenu Québec; the point of sale is a stub behind
  `APP_POS_ENABLED` until that scope and a payment provider are decided. No payment provider is wired.

## The shop page

Owners can reorder and show or hide the page's sections, and upload a logo. The per-shop `shop_page` record stores that
configuration; shops without a record keep the existing layout. Administrator feature switches always override owner
choices for upcoming wall, reels, reviews, follow and announcements sections. Photos are checked by their bytes and
stored under content-hashed Bunny paths (`brand/`, `gallery/`, and future media-purpose directories); uploads stay off
until media storage is configured.

## Start

```bash
corepack enable && pnpm install          # Node 22, pnpm 10 — also installs the pre-push hook
cp .env.example .env                       # a local PostgreSQL URL (a database of your own)
pnpm dev                                   # http://localhost:3000
pnpm run check                             # lint · typecheck · tests (what the hook and CI run)
```

The database tests run on a real PostgreSQL 16: CI's service, or a Testcontainers one locally (Docker).

## Inside

| Path | |
| :-- | :-- |
| `apps/web` | Next.js 16: the public page, sign-in (`@krizaka/ui/auth-layout`), the shop's day (appointments, plus the latest invoices and overdue count for members with invoice access), the administration (admin.akinaza.com), the BFF, the e-mail templates |
| `apps/mobile` | the Expo skeleton (joins the workspace in the mobile phase) |
| `packages/core` | the domain, pure: money, GST/QST, the ledger, the return and its reconciliation, consent, the POS gate |
| `packages/db` | PostgreSQL schema (Drizzle), versioned SQL migrations with the rules the database enforces, the shop's operations |

Rules for contributors and agents: [AGENTS.md](AGENTS.md). Security: [SECURITY.md](SECURITY.md).

## License

[FSL-1.1-ALv2](LICENSE.md) (Functional Source License, Apache-2.0 future licence) © Technologies Krizaka Inc. — read,
run, modify and self-host it for any purpose except offering a competing service; each version becomes Apache-2.0 two
years after its release. Commits before the licence change remain [Apache-2.0](LICENSE-APACHE) — see [NOTICE](NOTICE)
and [ADR-012](https://github.com/krizaka/.github/blob/main/docs/adr/ADR-012-licensing-libraries-open-products-fair-source.md).
The Krizaka names and birds are not licensed: [trademark policy](https://github.com/krizaka/.github/blob/main/TRADEMARKS.md).

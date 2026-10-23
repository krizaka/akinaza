<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/akinaza-dark.svg">
    <img src=".github/assets/akinaza-light.svg" alt="Akinaza" width="96">
  </picture>
</p>

# Akinaza

**Run your shop, for less.** The all-in-one for independent Québec shops — hair and beauty salons, studios, consultants, freelancers:
bookings, client files with Loi 25 consent, bilingual invoices with GST 5 % and QST 9.975 %, a tax ledger, and the
GST/QST return **prepared** for the merchant to review and file.

[![CI](https://github.com/krizaka/akinaza/actions/workflows/ci.yml/badge.svg)](https://github.com/krizaka/akinaza/actions/workflows/ci.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/krizaka/akinaza/badge)](https://scorecard.dev/viewer/?uri=github.com/krizaka/akinaza)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

Akinaza (商い *akinai*, trade) is a Krizaka product **in development**: nothing is deployed, sign-up is closed. The
know-how it shows: **running a shop, for less** — one tool instead of five, data in Canada, Loi 25 by design.

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
- **Live storefront** — team states and free times refresh from the shop's slots channel while the page is visible.
  SSE carries only a slots-changed signal, never booking details; without it, the visit-time render remains.
  Audited database settings in the admin configuration control `realtime.storefront.enabled` (default `true`),
  `realtime.storefront.heartbeatSeconds` (15; 5–60) and `realtime.storefront.maxStreamsPerPage` (100; 1–1000 concurrent
  streams per shop page per server instance). Streams reconnect within five minutes to reread settings; no rebuild is needed.
- **Loi 25** — consent per purpose, append-only; erasure blanks personal data and keeps the invoices tax law requires.
- **Accounts** — sign-in, "forgot password" with one-use 30-minute links (the answer is the same for every address), a password change that ends the other sessions, a profile with Krizaka's default picture; registration is built and closed by configuration (`AUTH_SIGNUP_ENABLED`).
- **Not for restaurants, cafés, bars and bakeries with on-site consumption** — they must use a sales recording system certified MEV-WEB by Revenu Québec; the point of sale is a stub behind
  `APP_POS_ENABLED` until that scope and a payment provider are decided. No payment provider is wired.

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

[Apache-2.0](LICENSE) © Krizaka

---

A [Krizaka](https://www.krizaka.com) product · Made in Montréal · Apache-2.0

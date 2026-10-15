<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/akinaza-dark.svg">
    <img src=".github/assets/akinaza-light.svg" alt="Akinaza" width="96">
  </picture>
</p>

# Akinaza

**Run your shop, for less.** The all-in-one for independent Québec shops — hair salons, bakeries, cafés, boutiques:
bookings, client files with Loi 25 consent, bilingual invoices with GST 5 % and QST 9.975 %, a tax ledger, and the
GST/QST return **prepared** for the merchant to review and file.

[![CI](https://github.com/krizaka/akinaza/actions/workflows/ci.yml/badge.svg)](https://github.com/krizaka/akinaza/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

Akinaza (商い *akinai*, trade) is a Krizaka product **in development**: nothing is deployed, sign-up is closed. The
know-how it shows: **running a shop, for less** — one tool instead of five, data in Canada, Loi 25 by design.

## What is built

- **Taxes to the cent** — money is integer cents; GST and QST are computed once on the taxable subtotal and rounded half
  away from zero (zero-rated lines stay at zero; a small supplier charges nothing). Tested on known invoices.
- **A ledger that balances** — every invoice posts its GST and QST to an append-only ledger; the database checks at
  commit that the lines make the subtotal and the ledger holds exactly the invoice's taxes. A correction is a credit note.
- **"Prepare my tax return"** — the FPZ-500 figures (lines 101, 103/106/109, 203/206/209) from the ledger, with their
  working papers; an Orazaka Studio assists, its figures reconciled against the ledger line by line. **Akinaza
  prepares; the merchant files.** Nothing is transmitted to any government.
- **Bookings** — services, staff, schedules; the database refuses a double booking (`EXCLUDE` on time ranges).
- **Loi 25** — consent per purpose, append-only; erasure blanks personal data and keeps the invoices tax law requires.
- **Not for restaurants and bars** — they must bill through a certified SRM (MEV); the point of sale is a stub behind
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
| `apps/web` | Next.js 16: the public page, sign-in (`@krizaka/ui/auth-layout`), the shop's day (appointments + an invoice with its GST/QST lines), the administration (admin.akinaza.com), the BFF, the e-mail templates |
| `apps/mobile` | the Expo skeleton (joins the workspace in the mobile phase) |
| `packages/core` | the domain, pure: money, GST/QST, the ledger, the return and its reconciliation, consent, the POS gate |
| `packages/db` | PostgreSQL schema (Drizzle), versioned SQL migrations with the rules the database enforces, the shop's operations |
| `packages/mcp` | the tax-assistant Studio contract, its client over Orazaka's edge, a fake Studio, the reconciliation |

Rules for contributors and agents: [AGENTS.md](AGENTS.md). Security: [SECURITY.md](SECURITY.md).

---

A [Krizaka](https://www.krizaka.com) product · Made in Montréal · Apache-2.0

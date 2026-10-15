# Akinaza — agent contract

> Governance of **`krizaka/akinaza`**: Akinaza, a Krizaka product — the operating system of independent Québec shops.
> Agent-neutral: humans and AI agents follow the same rules. Epic: krizaka/.github#52.

## 1. What this repository is

- A **pnpm + Turborepo** monorepo — one product, one repository: `apps/web` (Next.js 16: the public page, sign-in, the
  member's space, the administration and the BFF — route handlers are the only HTTP surface), `apps/mobile` (Expo,
  skeleton), `packages/core` (the domain, pure and deterministic), `packages/db` (PostgreSQL 16, Drizzle, versioned
  migrations, the shop's operations), `packages/mcp` (the tax-assistant Studio contract).
- **Built only from Krizaka bricks**: `@krizaka/ui` (auth-layout, app-shell, product-page, data-table, cards, mascots…),
  `@krizaka/query`, `@krizaka/i18n`, `@krizaka/icons`, `@krizaka/tokens` (`brands/akinaza.css`), `@krizaka/realtime`.
  A missing generic component goes to krizaka-ui, released, then used — never copied here. No `@tanstack/*` import, no
  `fetch` in a client `useEffect`, no hand-written `<table>` or multi-field `<form>`.

## 2. Non-negotiables

- **Akinaza prepares; the merchant files.** "Prepare my tax return" produces the GST/QST figures (FPZ-500) and their
  working papers; nothing in the code or the copy files, transmits or promises electronic transmission to Revenu Québec or
  the CRA. A test scans the e-mails for such a promise; the Studio contract has no filing call.
- **Money is integer cents.** No float, no `real`, no `numeric` read as a float. GST 5/100 and QST 9975/100000 are exact
  fractions, applied once per invoice on the taxable subtotal, rounded half away from zero (`@akinaza/core`). Changing a
  rate or a rounding rule needs a test on known invoices first.
- **The ledger is the authority.** Append-only (triggers); every invoice's ledger entries equal its taxes at commit (a
  deferred constraint trigger); a correction is a credit note. An AI's figures are reconciled against the ledger and every
  difference is shown — never silently adopted.
- **Restaurants and bars are excluded** (certified SRM / MEV required in Québec): the database refuses those shop kinds.
  The point of sale stays a stub behind `APP_POS_ENABLED`; **no payment provider is wired** (Oussama's decision).
- **Loi 25 by design.** Data in Canada, encrypted at rest (the managed database's volumes); consent per purpose, never
  pre-ticked, append-only; erasure blanks every personal field and keeps the invoices tax law requires (six years). The
  Loi 25 pack of Orazaka (orazaka-packs#14) is reused for the consent texts and the incident register when it lands.
- **AI only through Orazaka.** The tax assistant is an Orazaka Studio called on `AI_API_URL` with an `oz_` service key;
  receipts are read by Orazaka's document reading (Yomizaka's pack). Never a model called from here.

## 3. The product is independent

- No link to another Krizaka product, no family switcher. Krizaka is the publisher, named **only in the footer** and the
  legal mentions. The colour is the Akinaza brand (Laurentian forest green with warm copper), the mark
  `AkinazaLogo` ("the open shop"), the mascot **the beaver**, the artisan. Components use `--kz-*` roles only;
  dark and light are first-class.

## 4. Security of the dev environment

- Sign-up is closed server-side (`AUTH_SIGNUP_ENABLED` not `true` → 403); QA accounts only (`apps/web/scripts/qa-accounts.mjs`).
- The administration lives on **admin.akinaza.com** (same app, host-routed by `proxy.ts` / `lib/host.ts`; 404 on the
  product host); a session, the ADMIN role **and** an address of `AUTH_ALLOWED_IPS`. Never indexed.
- Passwords scrypt; sessions random tokens kept as keyed hashes; rate limits on sign-in; CSP same-origin, HSTS.
- Environment variables by bounded context (`APP_`, `DATABASE_`, `AUTH_`, `ABUSE_`, `AI_`, `REALTIME_`), declared once in
  `apps/web/lib/env.ts`. Secrets never in the repository, never printed (`~/.krizaka-worktrees/tools/secret.sh`).
- **Not deployed.** No DigitalOcean app, no DNS: hosting is Oussama's decision.

## 5. Database

- PostgreSQL 16, schema in `packages/db/src/schema.ts` (Drizzle). `pnpm --filter @akinaza/db db:generate` writes the
  next migration; rules the schema cannot say are custom SQL migrations. A merged migration is never edited.
- One database per worktree/session; never a shared or `*_demo` database from a session. Tests create a database per file
  on CI's PostgreSQL service or on a Testcontainers one.

## 6. Checks — local first, CI always

- **Before every push**: `pnpm run check` (lint · typecheck · tests), run by `.githooks/pre-push` (installed by
  `pnpm install`). Never push "to see what CI says". Never merge with a pending or red check (CodeQL included).
- **No test, not done**: every feature and fix ships with its tests; a fix starts with a failing test. The database rules
  are proven on a real PostgreSQL, never with mocks.
- Every visible page is checked in dark and light, desktop and phone. PR captures go to Bunny, never into the repository.
- Each notable UX choice has its entry in `docs/UX_DECISIONS.md`.

## 7. Text

- Every user-facing string is in `apps/web/messages/{en,fr}.json` (English the reference; `krizaka-i18n check` in
  `pnpm lint`); e-mails in `apps/web/mail-templates/<id>/<locale>/` (krizaka-notifications format). Never a locale ternary.

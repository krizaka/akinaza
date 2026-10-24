# Akinaza — agent contract

> Governance of **`krizaka/akinaza`**: Akinaza, a Krizaka product — the operating system of independent Québec shops.
> Agent-neutral: humans and AI agents follow the same rules. Epic: krizaka/.github#52.

## 1. What this repository is

- A **pnpm + Turborepo** monorepo — one product, one repository: `apps/web` (Next.js 16: the public page, sign-in, the
  member's space, the administration and the BFF — route handlers are the only HTTP surface), `apps/mobile` (Expo,
  skeleton), `packages/core` (the domain, pure and deterministic), `packages/db` (PostgreSQL 16, Drizzle, versioned
  migrations, the shop's operations).
- **Built only from Krizaka bricks**: `@krizaka/ui` (auth-layout, app-shell, product-page, data-table, cards, mascots…),
  `@krizaka/query`, `@krizaka/i18n`, `@krizaka/icons`, `@krizaka/tokens` (`brands/akinaza.css`), `@krizaka/realtime`.
  A missing generic component goes to krizaka-ui, released, then used — never copied here. No `@tanstack/*` import, no
  `fetch` in a client `useEffect`, no hand-written `<table>` or multi-field `<form>`.

- **Storefront photos are uploaded by the owner** (`/api/walker/media/upload`): JPEG/PNG/WebP checked by bytes, ≤ 2 MB after the
  phone redraws them, stored content-hashed under `user/akinaza/shops/<shop>/` of the media storage (`MEDIA_STORAGE_*`,
  `MEDIA_CDN_HOSTNAME`), only the CDN address kept. Off (503, the owner pastes an address) until the storage is configured.

- **Proposed images and videos (#267).** So that no section of a storefront is empty, each trade (`SHOP_TYPES` in `@akinaza/core`: salon, coaching,
  workshop, cleaning, pets, consulting - never a restaurant or a bar) has default media for the slots `cover` (image + silent loop), `gallery` and `service`
  (`packages/core/src/shop-media.ts`). The files are generated locally and never committed (`apps/web/scripts/default-media/`: FLUX.2 klein through
  `sd-cli`, ffmpeg loops, `sharp` renditions), live on the media CDN under `site/products/akinaza/defaults/<type>/<slot>/` (hashed names, uploaded with krizaka-com's
  `cdn-assets.mjs`), and are named by `apps/web/lib/default-media.manifest.json` (the only thing committed). They are neutral pictures: no real person, no text,
  never presented as the owner's shop. A slot the owner filled is never replaced; the owner chooses a proposal in « Images proposées » or turns them off
  (`shop_page.use_defaults`); the administrator holds `features.defaultMedia` and `storefront.defaultMedia.types`.
- **No mobile app in the dev preview.** `apps/mobile` is an unbuilt skeleton, outside the workspace until the mobile phase (A5,
  krizaka/.github#52); the walker's phone is served by the phone-first web app. The Dev preview criteria `mobile.*` are `na` for that
  reason (`dev-preview.json`); the day a mobile build exists, they become real criteria again.

## 2. Non-negotiables

- **Akinaza prepares; the merchant files.** "Prepare my tax return" produces the GST/QST figures (FPZ-500) and their
  working papers; nothing in the code or the copy files, transmits or promises electronic transmission to Revenu Québec or
  the CRA. A test scans the e-mails for such a promise.
- **Money is integer cents.** No float, no `real`, no `numeric` read as a float. GST 5/100 and QST 9975/100000 are exact
  fractions, applied once per invoice on the taxable subtotal, rounded half away from zero (`@akinaza/core`). Changing a
  rate or a rounding rule needs a test on known invoices first.
- **The ledger is the authority.** Append-only (triggers); every invoice's ledger entries equal its taxes at commit (a
  deferred constraint trigger); a correction is a credit note. An AI's figures are reconciled against the ledger and every
  difference is shown — never silently adopted.
- **Restaurants, cafés, bars and bakeries are excluded** (a sales recording system certified MEV-WEB is required in Québec): the database refuses those shop kinds. Akinaza targets service businesses only.
  The point of sale stays a stub behind `APP_POS_ENABLED`. **Subscription payments (the founder offer, 39 $ CAD/month) go through a payments port** (`apps/web/lib/payments`, ADR-003): the vendor is configuration (`PAYMENTS_PROVIDER`), the price is data at the vendor, the webhook is verified and idempotent; the offer shows only when `APP_FOUNDER_OFFER_ENABLED`. No merchant payment (the shop's own sales) is wired.
- **Loi 25 by design.** Data in Canada, encrypted at rest (the managed database's volumes); consent per purpose, never
  pre-ticked, append-only; erasure blanks every personal field and keeps the invoices tax law requires (six years). The
  Loi 25 pack of Orazaka (orazaka-packs#14) is reused for the consent texts and the incident register when it lands.
- **No AI in the product, in its screens or its words.** Akinaza says what it does (appointments, invoices, tax figures) in plain words; never « IA », « intelligent » or « révolutionnaire ». If a model is ever needed, it goes through Orazaka, behind a port, and the epic krizaka/akinaza#161 is reopened first.
  **One model is now involved (2026-10-23, #258, decision recorded on #161): translating the shop page's texts.** It goes through the `TranslationPort`
  (`packages/db/src/translation-port.ts`; the adapter in `apps/web/lib/translation.ts` calls the Orazaka Studio `text-translation`, krizaka/orazaka-packs#119).
  Only the page's own texts and a glossary (shop name, service names, street address) are sent, never anything about a client. The owner sees
  « traduction automatique » (never « IA »), edits any text, an edited text is never overwritten without asking, and a text whose source changed is flagged « à revoir ».
  The administrator holds `features.storefrontTranslation`, `storefront.languages.allowed` and `limits.translationsPerShopPerDay`. Nothing else in Akinaza uses a model: the ledger, the figures and the tax return stay deterministic.

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
- Environment variables by bounded context (`APP_`, `DATABASE_`, `AUTH_`, `ABUSE_`, `REALTIME_`), declared once in
  `apps/web/lib/env.ts`. Secrets never in the repository, never printed (`~/.krizaka-worktrees/tools/secret.sh`).
- **Not deployed.** No DigitalOcean app, no DNS: hosting is Oussama's decision.

## 5. Database

- PostgreSQL 16, schema in `packages/db/src/schema.ts` (Drizzle). `pnpm --filter @akinaza/db db:generate` writes the
  next migration; rules the schema cannot say are custom SQL migrations. A merged migration is never edited.
- One database per worktree/session; never a shared or `*_demo` database from a session. Tests create a database per file
  on CI's PostgreSQL service or on a Testcontainers one.
- **Tenant isolation (#247).** A shop's data is reachable only by that shop's members, and nothing tells anyone else it exists.
  - Every table is classified in `packages/db/src/tenancy.ts` (`TABLE_OWNERSHIP`): `shop` (carries `shop_id`: NOT NULL, a foreign
    key to shops, the leading column of an index), `child` (reached through a parent that ends at a `shop` table), `scoped`,
    `account` or `platform`. A new table that is not classified fails `tenancy.test.ts`: say whose data it holds before it ships.
  - A route works on "the" shop through `requireShop` / `requireOwner` / `requireShopClient` (`lib/access.ts`), never on a shop id
    taken from the request. Another shop's id (`?shopId=`) and another shop's resource answer **404**, the answer of an id that does
    not exist (never 403, which would confirm it). Two idempotent deletes (hours, zones) answer 200 and change nothing; two
    package codes (`AK_NO_REPORT` 409, `INVITE_INVALID` 400) are the same for a foreign and an unknown id.
  - `app/api/tenant-isolation.integration.test.ts` walks every `app/api/walker/**` route: without a session (401), as a member of
    another shop (404), and with a resource of another shop (404). A new walker route must use a shop guard, or be declared in the
    test (`SESSION_OWNED`, `RESOURCES`) with its reason; the test fails otherwise.

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

## Static rules & codemods (ast-grep)

The org code rules (addendum 2026-10-15) are lint rules, not review comments. [`@ast-grep/cli`](https://ast-grep.github.io)
is a **pinned devDependency** (no global install, CI reproduces local): `sgconfig.yml` + `rules/*.yml` (one rule per file,
with a message and, where safe, a `fix:`; written for Tsx and `.ts` is parsed as Tsx too, so each rule covers `.ts` and `.tsx`), `rule-tests/` (valid/invalid cases of each rule).

| Rule | What it refuses |
| :--- | :--- |
| `no-hand-ms-*`, `no-get-time-difference`, `no-get-time-arithmetic` | hand-written time arithmetic (`n * 60 * 1000`, `a.getTime() - b.getTime()`): date-fns, or a duration read from the settings |
| `no-env-in-domain` | an `env` import in domain code (`packages/*/src`, `src/`): the value arrives as a parameter |
| `no-db-in-service-or-rules` | a db client / schema import in `*.service.ts`, `*-service.ts`, `*.rules.ts`, `*-rules.ts` |
| `no-ts-enum` | the TypeScript `enum` keyword (`as const` object + derived type, or a Postgres enum) |
| `no-enum-string-compare` | `x.status === "OPEN"` (field named status/kind/role/reason/state/direction compared to a string literal) |
| `no-ambient-clock` | `new Date()` / `Date.now()` in domain code: the clock is injected |
| `no-types-at-package-root` | `types.ts` at a package root (`<feature>/<feature>.types.ts`) |
| `no-unjustified-numeric-export` | a numeric (or `…ToMilliseconds(n)`) `export const` in feature code without `// @fixed: <reason>` just above |
| `no-hand-made-nav`, `no-hand-made-language-switch` | a navigation bar that is not `NavBar` of @krizaka/ui (own Radix NavigationMenu, a local `NavBar`/`TopNav`), a hand-made language switch (`hrefLang` in a component, a row of `aria-pressed={locale === …}` buttons): use `NavBar` and `NavBar.Language` (« Navigation in the family », ui.krizaka.com) |

- **Run**: `npm run lint` runs everything (it includes `ast-grep test` and the ratchet). `npx ast-grep scan` lists the
  violations with their message; `npm run lint:sg:test` runs the rule tests.
- **Ratchet**: `scripts/sg-ratchet.mjs` counts the violations per rule and refuses any increase against
  `sg-ratchet.json` (same idea as `krizaka-ratchet` / `lint-ratchet.json`: the debt only goes down). Fixed some? Lock the gain with
  `npm run sg:ratchet:update` (it never raises a count and records a new rule at its current count). A new rule is
  added with its test in `rule-tests/` and its baseline in the same pull request. The script is identical in every
  Krizaka TypeScript repository (keep the copies identical; its unit test is `scripts/sg-ratchet.test.mjs`).
- **Codemods**: `npm run sg:fix` applies the `fix:` of the rules (`ast-grep scan --update-all`) and adds the date-fns import;
  behaviour is identical — run `npm run lint && npm test` after, and land the result in a small pull request.
- A rule is never silenced to get a PR green; fix the code, or (a business parameter that is a technical fact) justify it with `// @fixed:`.

## Before you open or update a pull request (coding agents)

These are the defects code review found most often on 2026-10-23. Check them yourself before you open or update a pull request:
1. **Checks:** run the repository's full check (lint, typecheck, tests, build) and fix it. Never push a red check.
2. **Concurrency:** any « count then insert » or « check then write » runs in one transaction with a lock, and has a concurrency test.
3. **One gate:** a rule (limit, permission, validation) is enforced in the service, so no route can skip it. Test every route.
4. **Errors:** a cleanup (ROLLBACK, DROP, close) never masks the original error. Rethrow it, or throw an `AggregateError` with the original first.
5. **Validation:** validate the original input, never a truncated or pre-trimmed copy. Server and client reject the same inputs.
6. **Accessibility:**
   - every control has a unique label, and FR/EN pairs say their language;
   - focus rings are never clipped by `overflow`;
   - text never overflows its box at 360 px.
7. **Naming:** environment variables follow `<CONTEXT>_<THING>` (`APP_`, `DATABASE_`, `AUTH_`, `MEDIA_`, `MAIL_`, `PAYMENTS_`, `AI_`…) and are declared once.
8. **Words:** every user-facing string is in the FR and EN messages, and no colour is hard-coded.
9. **Review threads:** answer every one. Fix it test-first, or reply with the reason, then resolve it.

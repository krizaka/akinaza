# ADR-003 — Payments behind a port: the founder offer

Status: accepted (2026-10-22). Issue: krizaka/akinaza#131.

## Context
Akinaza sells one founder offer: 39 $ CAD a month, setup included, limited to the first shops. The org rules: the domain has no
infrastructure and no vendor SDK, a vendor is chosen in configuration, prices and rules are data.

## Decision
- **A payments port** (`apps/web/lib/payments/port.ts`): `createCustomer`, `checkout`, `portal`, `parseWebhook`, with
  vendor-free events (`subscription_started`, `subscription_changed`). The domain (`lib/billing.ts`) and the routes import no vendor.
- **The adapter is configuration**: `lib/payments/stripe-adapter.ts` (a small client over `fetch`, no SDK), chosen by
  `PAYMENTS_PROVIDER` in `lib/payments/config.ts`, the only file that picks it. Same shape as Yomizaka's (krizaka/yomizaka
  ADR-0004): the third product to need it extracts it into one shared package.
- **The price is data at the processor**, found by lookup key (`PAYMENTS_PRICE_KEY_FOUNDER`); `scripts/payments-setup.mjs` creates the
  product, the price, the customer-portal configuration and the webhook endpoint (idempotent; live mode is refused without `--i-am-the-owner`).
- **Taxes**: the processor's automatic tax (GST 5 % + QST 9.975 %).
- **State** (migration `0010_billing`): `accounts.payment_customer_id`, `payment_subscription_id`, `subscription_status`,
  `current_period_end`; `payment_events(id)` makes each notification apply once. The webhook is the only writer of paid state.
- **The offer is shown** on the public page only when `APP_FOUNDER_OFFER_ENABLED=true`, once a test-card checkout is proven.

## Consequences
Live mode is a change of keys and of the processor account, not of code.

## Addendum (2026-10-25, akinaza#363): the grid, the limit, no fee
- **Prices are data in one module**, `apps/web/lib/pricing.ts`: founder 39 $ a month, plus taxes, setup included; regular 49 $ a month, plus taxes,
  **not public** (no page shows it while sign-up is closed). `infra/payments/catalogue.json` holds both for the processor; `lib/pricing.test.ts` keeps them equal.
  Every price shown says « plus taxes », and no amount is typed in a message.
- **The founder offer's limit is a setting**, `plans.founder.limit` (default 20 businesses, global). A business holds a seat from its first
  subscription (`accounts.payment_subscription_id`). Once the limit is reached the checkout answers 409 `FOUNDER_OFFER_FULL` and the page says the
  offer is complete. A founder is never turned away, and keeps the founder price as long as the subscription runs: the webhook writes the state
  of the subscription, never its price (`lib/founder-seats.test.ts`). Concurrent checkouts opened before the last seat is taken can overshoot the
  limit by the number in flight; the seat is counted when the processor confirms.
- **Never a fee on transactions**: a plan is a flat monthly subscription; the catalogue has no field for a percentage, and the code never sends an
  application fee (`lib/pricing.test.ts`).

## Addendum (2026-10-25, akinaza#371, ADR-009 krizaka/.github#253): prices from the catalogue
- **Prices are a catalogue the administrator edits** (`@krizaka/settings`, `definePrices`): `apps/web/lib/pricing.ts` is only its **seed**.
  `akinaza.founder` 39 $ a month plus taxes, setup included, `founder-limited` (`founderCap` 20; the administrator ends it by making it
  `internal`); `akinaza.starter` 45 $ a month plus taxes, `public`; `akinaza.scale` (Scale B2B) 99 $ a month plus taxes, `public` — its B2B
  features are not built yet and are worded « soon », never claimed. Every entry: `cardFeeBps` 0; pre-authorised debit / B2B transfer
  orchestration fee Starter and founder `directDebitBps` 50 capped at `directDebitCapCents` 1500, Scale 25 / 1000. The funds stay with the
  processor; Krizaka only takes an application fee. They replace the regular 49 $ plan above.
- **One catalogue on the server** (`lib/price-catalogue.ts`): the seed plus the versions in `price_versions` (migration `0035_prices`), each
  audited in `settings_audit`. The administrator sees each entry, schedules a change from a date (never the past) and reads the history at
  `/console/prices` (SettingsSection / SettingsRow until krizaka/krizaka-ui#713).
- **The founder cap is the founder entry's `founderCap`**; the setting `plans.founder.limit` is retired by `0035_prices` (an override, if any,
  stays in the audit trail and is re-entered on the prices page) — one source only.
- **The home, the subscription page and the checkout read the catalogue.** The checkout sells only when the processor's amount equals the
  entry's (503 `PRICE_NOT_READY` otherwise: a scheduled change is set up at the processor with `pnpm run payments:setup` first), and keeps the
  entry's `versionId` on the account (`accounts.subscription_price_version`) while it has no subscription; nothing rewrites it afterwards, so
  a founder keeps the founder price. Lookup keys: `akinaza_founder_monthly_cad`, `akinaza_starter_monthly_cad`, `akinaza_scale_monthly_cad`
  (`PAYMENTS_PRICE_KEY_FOUNDER`, `PAYMENTS_PRICE_KEY_STARTER`, `PAYMENTS_PRICE_KEY_SCALE`).
- **0 % on cards** in every entry; a pre-authorised debit or B2B transfer carries the entry's rate, capped per order (`directDebitFeeCents`).
  This replaces #363's « no fee field » test: 0 % on cards in every entry, and the debit fee of any order is at most the entry's cap.
  No message types an amount (`findTypedPrices`).

## Amendment (2026-10-29): the grid is lowered, three months free, an association plan

The founder found $45 and $99 a little expensive. The CTO's grid, to be adjusted after the first clients (CAD, plus taxes):

| Plan | Price | Offer |
| :--- | :--- | :--- |
| Starter | $29 a month | 3 months free (trial; no card at sign-up if the processor allows it, else a card charged $0 for 3 months) |
| Pro (the current « Scale ») | $69 a month | none |
| Association (registered non-profit, OBNL, charity) | Starter features, $1 a month | 3 months free, then $1 a month |

Rules:
- Every price, trial length and offer is **data in the admin catalogue** (`@krizaka/settings` price versions, dated, audited), never in code: the seed in `lib/pricing.ts` is replaced by the first scheduled version, and the trial and the association rate are entries or limits of the catalogue (`trialMonths`), not constants.
- The association plan needs **proof**: the shop submits its NEQ (Registraire des entreprises du Québec), its registered charity number or its incorporation document; an administrator verifies and approves it from a queue (audited). Until approved, the shop is on Starter.
- The pricing page reads the catalogue (EN/FR): « 3 mois offerts », « Associations : 3 mois gratuits, puis 1 $ par mois », taxes stated, no urgency. The « Soon » items stay as they are.
- The processor side is set up in **test mode only** (`sk_live_` is refused). A migration leaves existing subscribers on the version they were sold at (`subscription_price_version`, ADR-009): grandfathered, never repriced.
- Status: decision recorded here; the implementation (catalogue versions, trial in the checkout, association proof queue, pricing page, captures) is a separate block.

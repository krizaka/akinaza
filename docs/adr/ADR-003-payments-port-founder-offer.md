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
  **not public** (no page shows it while sign-up is closed). `payments/catalogue.json` holds both for the processor; `lib/pricing.test.ts` keeps them equal.
  Every price shown says « plus taxes », and no amount is typed in a message.
- **The founder offer's limit is a setting**, `plans.founder.limit` (default 20 businesses, global). A business holds a seat from its first
  subscription (`accounts.payment_subscription_id`). Once the limit is reached the checkout answers 409 `FOUNDER_OFFER_FULL` and the page says the
  offer is complete. A founder is never turned away, and keeps the founder price as long as the subscription runs: the webhook writes the state
  of the subscription, never its price (`lib/founder-seats.test.ts`). Concurrent checkouts opened before the last seat is taken can overshoot the
  limit by the number in flight; the seat is counted when the processor confirms.
- **Never a fee on transactions**: a plan is a flat monthly subscription; the catalogue has no field for a percentage, and the code never sends an
  application fee (`lib/pricing.test.ts`).

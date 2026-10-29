#!/usr/bin/env bash
# Runs after the production build (shared node-ci.yml `after-build`; the repository root is the working directory):
# the SEO family contract on the built site, sign-up closed, and the responsive guard in a real browser.
# The browsers are installed and cached by node-ci (`playwright: chromium`).
set -euo pipefail
export NODE_ENV=production
# The app's declared public origin (landingRedirect requires it in production: never read from the request's Host).
export APP_PUBLIC_URL=http://localhost:3000
# CI-only secrets, generated for this run (never a literal: gitleaks scans the repository).
export AUTH_SESSION_SECRET="$(openssl rand -hex 32)"
export APP_DATA_ENCRYPTION_KEY="$(openssl rand -base64 32)"
export PORT=3000
# The server's clock is UTC, as the deployed one's; the crawls' browsers run in a visitor's zone (check-hydration.mjs).
export TZ=UTC
trap 'tail -100 web.log || true' ERR
(cd apps/web && pnpm exec next start -p 3000 > ../../web.log 2>&1 &)
# The signed-in pages and the storefronts need a database: the migrations, the three demo shops, the QA accounts and the
# walker persona on CI's PostgreSQL (DATABASE_URL), with CI-only passwords. The crawl signs in as the walker (the owner) and as
# Camille, a seeded client with bookings and invoices (the QA user has no client file: it would only see the empty state).
export HYDRATION_OWNER_EMAIL=lea.beaulieu@akinaza.test HYDRATION_OWNER_PASSWORD=ci-only-password-walker
export HYDRATION_CLIENT_EMAIL=camille.tremblay@akinaza.test HYDRATION_CLIENT_PASSWORD=ci-only-password-client
pnpm --filter @akinaza/db seed:demos
QA_USER_EMAIL=qa-user@akinaza.test QA_USER_PASSWORD=ci-only-password-user QA_ADMIN_EMAIL=qa-admin@akinaza.test QA_ADMIN_PASSWORD=ci-only-password-admin node apps/web/scripts/qa-accounts.mjs
QA_WALKER_PASSWORD="$HYDRATION_OWNER_PASSWORD" QA_CLIENTS_PASSWORD="$HYDRATION_CLIENT_PASSWORD" pnpm --filter @akinaza/web exec tsx scripts/seed-saint-henri.mjs
for _ in $(seq 1 60); do curl -sf http://localhost:3000/api/healthz && break; sleep 1; done
pnpm run seo:check
# Every cookie the app sets is host-only (no Domain, Path=/, __Host- on https): akinaza#534, ADR-005.
node scripts/check-cookies.mjs --base http://localhost:3000 --email "$HYDRATION_CLIENT_EMAIL" --password "$HYDRATION_CLIENT_PASSWORD"
# The brand icons and their lock = the CDN manifest (the unit test checks icons = lock offline).
node scripts/sync-brand-icons.mjs --check
# Responsive guard: no horizontal overflow at 360–1440 px in both themes, and the accessibility guard (axe-core, contrast included).
pnpm run check:overflow -- --base http://localhost:3000   # also axe-core WCAG 2.1 AA, ratcheted by a11y-baseline.json (--a11y-update lowers it)
# No empty map (akinaza#488): the shop page's live map has a box and a canvas, both themes.
pnpm run check:maps -- --base http://localhost:3000
# Performance budgets of the public shop pages (akinaza#401, ADR-004): LCP, CLS, phone screens, and the client JS ratchet (perf-budgets.json).
# The absolute budgets are reported without failing (PERF_BLOCKING=0) until the variance of three runs is read; the JS ratchet always fails.
PERF_BLOCKING=0 pnpm run check:perf -- --base http://localhost:3000
cat perf-report.json | head -c 6000
# One rendering for the server and the browser: no React hydration error on any page, signed out, as a client, as an owner.
pnpm run check:hydration -- --base http://localhost:3000
# The shop page composer end to end (akinaza#427): reorder, autosave, publish, rollback resets the draft, discard; no overflow.
E2E_BASE=http://localhost:3000 E2E_OWNER_EMAIL="$HYDRATION_OWNER_EMAIL" E2E_OWNER_PASS="$HYDRATION_OWNER_PASSWORD" E2E_OUT=e2e-composer-out pnpm run e2e:composer
test "$(curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3000/api/auth/sign-up)" = "403"

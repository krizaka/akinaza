#!/usr/bin/env bash
# Runs after the production build (shared node-ci.yml `after-build`; the repository root is the working directory):
# the SEO family contract on the built site, sign-up closed, and the responsive guard in a real browser.
# The browsers are installed and cached by node-ci (`playwright: chromium`).
set -euo pipefail
export NODE_ENV=production
export AUTH_SESSION_SECRET=ci-only-session-secret-0123456789abcdef
export APP_DATA_ENCRYPTION_KEY=Y2ktb25seS1kYXRhLWtleS0zMi1ieXRlcy0xMjM0NTY=
export PORT=3000
# The server's clock is UTC, as the deployed one's; the crawls' browsers run in a visitor's zone (check-hydration.mjs).
export TZ=UTC
trap 'tail -100 web.log || true' ERR
(cd apps/web && npx next start -p 3000 > ../../web.log 2>&1 &)
# The signed-in pages and the storefronts need a database: the migrations, the three demo shops, the QA accounts and the
# walker persona on CI's PostgreSQL (DATABASE_URL), with CI-only passwords.
export HYDRATION_OWNER_EMAIL=lea.beaulieu@akinaza.test HYDRATION_OWNER_PASSWORD=ci-only-password-walker
export HYDRATION_CLIENT_EMAIL=qa-user@akinaza.test HYDRATION_CLIENT_PASSWORD=ci-only-password-client
pnpm --filter @akinaza/db seed:demos
QA_USER_EMAIL="$HYDRATION_CLIENT_EMAIL" QA_USER_PASSWORD="$HYDRATION_CLIENT_PASSWORD" QA_ADMIN_EMAIL=qa-admin@akinaza.test QA_ADMIN_PASSWORD=ci-only-password-admin node apps/web/scripts/qa-accounts.mjs
QA_WALKER_PASSWORD="$HYDRATION_OWNER_PASSWORD" QA_CLIENTS_PASSWORD=ci-only-password-client pnpm --filter @akinaza/web exec tsx scripts/seed-saint-henri.mjs
for _ in $(seq 1 60); do curl -sf http://localhost:3000/api/healthz && break; sleep 1; done
pnpm run seo:check
# The brand icons and their lock = the CDN manifest (the unit test checks icons = lock offline).
node scripts/sync-brand-icons.mjs --check
# Responsive guard: no horizontal overflow at 360–1440 px in both themes.
pnpm run check:overflow -- --base http://localhost:3000
# One rendering for the server and the browser: no React hydration error on any page, signed out, as a client, as an owner.
pnpm run check:hydration -- --base http://localhost:3000
test "$(curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3000/api/auth/sign-up)" = "403"

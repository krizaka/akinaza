#!/usr/bin/env bash
# The app for the visual regression (krizaka/.github#375, the org's visual-regression.yml): the built web app on localhost:3000,
# the cast seeded (krizaka/.github#356), the moment the seed finished written to .visual-now (the browser's clock for the captures).
# PostgreSQL is the workflow's `postgres` service (host `postgres`, which the seed treats as local: its default cast passwords).
# Dev data only: the seed refuses anything but APP_ENVIRONMENT=dev.
set -euo pipefail
export APP_ENVIRONMENT=dev
export APP_SEARCH_INDEXING=off
export DATABASE_URL="postgresql://ci:ci-only-password@postgres:5432/ci"
export AUTH_SESSION_SECRET=ci-only-session-secret-0123456789abcdef
export APP_DATA_ENCRYPTION_KEY="$(openssl rand -base64 32)" # a throwaway key per run: the database starts empty and is thrown away
export PORT=3000
# One fixed instant for the pages' clock and the cast's days (a Wednesday, 11 am in Montreal): the open-now chip and the free times never follow the hour of the run. Honoured only with APP_ENVIRONMENT=dev.
export APP_FIXED_NOW=2026-10-28T15:00:00Z
# The app's declared public origin (landingRedirect requires it in production: never read from the request's Host).
export APP_PUBLIC_URL=http://localhost:3000
pnpm --filter @akinaza/web build
export NODE_ENV=production
trap 'tail -100 web-visual.log || true' ERR
# The cast first (it migrates), then the server on it.
pnpm --filter @akinaza/web exec tsx scripts/seed-cast.mjs --check
(cd apps/web && nohup npx next start -p 3000 > ../../web-visual.log 2>&1 &)
for _ in $(seq 1 90); do curl -sf http://localhost:3000/api/healthz >/dev/null && break; sleep 1; done
curl -sf http://localhost:3000/api/healthz >/dev/null
date -u +%Y-%m-%dT%H:%M:%SZ > .visual-now
echo "ready: http://localhost:3000 (dev, the cast seeded)"

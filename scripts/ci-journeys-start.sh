#!/usr/bin/env bash
# The app for the critical journeys (krizaka/.github journeys.yml `setup-command`; krizaka-internal#1934): the production build, the demo cast
# on a throwaway PostgreSQL, and two servers on it. The guest booking is behind a CAPTCHA: Cloudflare's published TEST keys (always pass on :3000,
# always fail on :3001; public, never valid in production, refused when APP_ENVIRONMENT=prod). The mail goes to the journey's own mailbox (:3299).
set -euo pipefail
corepack enable
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium
docker run -d --name journeys-pg -e POSTGRES_USER=ci -e POSTGRES_PASSWORD=ci-only-password -e POSTGRES_DB=ci -p 5432:5432 postgres:16 > /dev/null
for _ in $(seq 1 30); do docker exec journeys-pg pg_isready -U ci > /dev/null 2>&1 && break; sleep 1; done
export APP_ENVIRONMENT=dev
export APP_SEARCH_INDEXING=off
export DATABASE_URL="postgresql://ci:ci-only-password@localhost:5432/ci"
export AUTH_SESSION_SECRET=ci-only-session-secret-0123456789abcdef
export APP_DATA_ENCRYPTION_KEY="$(openssl rand -base64 32)"
export APP_FIXED_NOW=2026-10-28T15:00:00Z
export TZ=UTC
# Cloudflare's documented test keys: the site key is read at build time, the server keys per process.
export NEXT_PUBLIC_ABUSE_CAPTCHA_SITE_KEY=1x00000000000000000000AA
export ABUSE_CAPTCHA_PROVIDER=turnstile
export MAIL_PROVIDER=mailgun MAIL_API_KEY=e2e MAIL_DOMAIN=mg.e2e.test MAIL_API_URL=http://127.0.0.1:3299
pnpm --filter @akinaza/web build
export NODE_ENV=production
pnpm --filter @akinaza/web exec tsx scripts/seed-cast.mjs --check
trap 'tail -100 web-journeys.log web-journeys-fail.log || true' ERR
(cd apps/web && ABUSE_CAPTCHA_SECRET_KEY=1x0000000000000000000000000000000AA PORT=3000 APP_PUBLIC_URL=https://journeys.akinaza.test nohup npx next start -p 3000 > ../../web-journeys.log 2>&1 &)
(cd apps/web && ABUSE_CAPTCHA_SECRET_KEY=2x0000000000000000000000000000000AA PORT=3001 APP_PUBLIC_URL=https://journeys.akinaza.test nohup npx next start -p 3001 > ../../web-journeys-fail.log 2>&1 &)
for port in 3000 3001; do
  for _ in $(seq 1 90); do curl -sf "http://localhost:${port}/api/healthz" > /dev/null && break; sleep 1; done
  curl -sf "http://localhost:${port}/api/healthz" > /dev/null
done
echo "ready: :3000 (captcha passes), :3001 (captcha refuses), the cast seeded"

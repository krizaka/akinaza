#!/usr/bin/env bash
# The backend of the phone's Maestro flows (krizaka/.github#241, mobile-e2e.yml's `setup-command`): a throwaway PostgreSQL and
# the built web app on localhost:3000, with the fictional Saint-Henri dog walker (Léa Beaulieu, the shop's owner) seeded for
# DEMO_ACCOUNT_EMAIL / DEMO_ACCOUNT_PASSWORD (made by the workflow, masked, for this run only). A fresh database every run,
# so the demo data is reset each time. The emulator reaches it through `adb reverse`. Dev only, nothing here is a real
# secret or a real account.
set -euo pipefail
: "${DEMO_ACCOUNT_EMAIL:?DEMO_ACCOUNT_EMAIL is required}"
: "${DEMO_ACCOUNT_PASSWORD:?DEMO_ACCOUNT_PASSWORD is required}"

DB_PASS="$(openssl rand -hex 16)"
echo "::add-mask::$DB_PASS"
docker run -d --name e2e-pg -p 5432:5432 -e POSTGRES_USER=akinaza -e POSTGRES_PASSWORD="$DB_PASS" -e POSTGRES_DB=akinaza postgres:16 >/dev/null
for _ in $(seq 1 60); do docker exec e2e-pg pg_isready -U akinaza >/dev/null 2>&1 && break; sleep 1; done

export APP_ENVIRONMENT=dev
export DATABASE_URL="postgresql://akinaza:${DB_PASS}@localhost:5432/akinaza"
export AUTH_SESSION_SECRET="$(openssl rand -hex 32)"
APP_DATA_ENCRYPTION_KEY="$(openssl rand -base64 32)"
export APP_DATA_ENCRYPTION_KEY
export PORT=3000
export TZ=UTC

pnpm --filter @akinaza/web build
export NODE_ENV=production
trap 'tail -100 web-mobile-e2e.log || true' ERR
(cd apps/web && nohup npx next start -p 3000 > ../../web-mobile-e2e.log 2>&1 &)
for _ in $(seq 1 90); do curl -sf http://localhost:3000/api/healthz >/dev/null && break; sleep 1; done
curl -sf http://localhost:3000/api/healthz >/dev/null

# The migrations ran at the server's start; now the demo shops and the walker persona, whose owner signs in on the phone.
pnpm --filter @akinaza/db seed:demos
QA_WALKER_PASSWORD="$DEMO_ACCOUNT_PASSWORD" QA_CLIENTS_PASSWORD="$(openssl rand -hex 16)" pnpm --filter @akinaza/web exec tsx scripts/seed-saint-henri.mjs
# A visit today at "now + 1 h" (the injected clock, never a typed date), so the phone's Aujourd'hui flow always goes list, detail, start, finish (#433).
pnpm --filter @akinaza/web exec tsx scripts/seed-today-visit.mjs
echo "backend ready: http://localhost:3000 (dev, the Saint-Henri walker)"

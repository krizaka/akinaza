#!/usr/bin/env bash
# Runs after the production build (shared node-ci.yml `after-build`; the repository root is the working directory):
# the SEO family contract on the built site, sign-up closed, and the responsive guard in a real browser.
# The browsers are installed and cached by node-ci (`playwright: chromium`).
set -euo pipefail
export NODE_ENV=production
export AUTH_SESSION_SECRET=ci-only-session-secret-0123456789abcdef
export AI_API_KEY=oz_ci_only_not_a_key
export APP_DATA_ENCRYPTION_KEY=Y2ktb25seS1kYXRhLWtleS0zMi1ieXRlcy0xMjM0NTY=
export PORT=3000
trap 'tail -100 web.log || true' ERR
(cd apps/web && npx next start -p 3000 > ../../web.log 2>&1 &)
for _ in $(seq 1 60); do curl -sf http://localhost:3000/api/healthz && break; sleep 1; done
pnpm run seo:check
# Responsive guard: no horizontal overflow at 360–1440 px in both themes.
pnpm run check:overflow -- --base http://localhost:3000
test "$(curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3000/api/auth/sign-up)" = "403"

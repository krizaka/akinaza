# CI and deploy — Akinaza

**CI.** `.github/workflows/ci.yml` calls the organisation's reusable [`node-ci.yml`](https://github.com/krizaka/.github/blob/main/.github/workflows/node-ci.yml)
(pnpm and Playwright caches, `.next/cache`, PostgreSQL 16, timeouts, the `changes` gate). A change that touches only `docs/`, policy text or
templates skips the heavy job; the required check « Lint · Typecheck · Tests · Build » still reports green. After the production build,
`scripts/ci-after-build.sh` runs the SEO family contract, checks that sign-up is closed and the responsive guard.

**Deploy.** `.krizaka-deploy.json` describes `akinaza-dev` (dev.akinaza.com, a noindex site). From a checkout of
[krizaka/.github](https://github.com/krizaka/.github) (`cd deploy && npm ci`):

```bash
node <krizaka/.github>/deploy/bin/krizaka-deploy.mjs deploy --dry-run --apply   # reads everything, changes nothing
node <krizaka/.github>/deploy/bin/krizaka-deploy.mjs deploy --apply --expect-sha "$(git rev-parse origin/main)"
```

It refuses any doctl context but `default`, asserts `APP_SEARCH_INDEXING=off`, never blanks a secret (live values are kept, `secret.sh @akinaza`
fills the rest), force-rebuilds, waits for ACTIVE, then checks the health URL, robots/noindex and `check-seo-family.mjs`, and prints the
previous deployment (the rollback target). See [docs/standards/ci-and-deploy.md](https://github.com/krizaka/.github/blob/main/docs/standards/ci-and-deploy.md).

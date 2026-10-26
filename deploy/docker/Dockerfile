# -------------------------------------------------------------
# Akinaza web — production image: the Next.js standalone server (apps/web). The SQL migrations travel inside it and are applied
# at start on a direct connection (lib/db.ts, instrumentation.ts). Built by App Platform from deploy/digitalocean/app.yaml.
# -------------------------------------------------------------
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS base
RUN apk add --no-cache libc6-compat && corepack enable
WORKDIR /app

# 1. Dependencies, from the lockfile only
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/core/package.json ./packages/core/
COPY packages/db/package.json ./packages/db/
RUN pnpm install --frozen-lockfile --ignore-scripts

# 2. Build
FROM base AS builder
COPY --from=deps /app ./
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production
# Settings inlined or read at build (App Platform passes them as build arguments): the commit shown as the version, and
# whether search engines may index the deployment (off on every dev one).
ARG APP_COMMIT_SHA
ARG APP_SEARCH_INDEXING
ENV APP_COMMIT_SHA=$APP_COMMIT_SHA APP_SEARCH_INDEXING=$APP_SEARCH_INDEXING
RUN pnpm --filter @akinaza/web build

# 3. Run
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
# The runtime starts `node` only: npm and corepack (and the dependencies they bundle, flagged by the image scan) are not shipped.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
# E-mail templates are read from disk at run time (data, not code); the migrations are applied at start.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/mail-templates ./apps/web/mail-templates
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/drizzle ./packages/db/drizzle
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider "http://localhost:3000/api/healthz" || exit 1
CMD ["node", "apps/web/server.js"]

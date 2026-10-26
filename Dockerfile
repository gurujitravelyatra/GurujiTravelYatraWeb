# syntax=docker/dockerfile:1

# CRM-migration Step 5 (2026-10-26) — the `prisma generate`/`prisma/` COPY
# steps and the `openssl` apk package this file's previous header described
# fixing are REMOVED, not merely unused: `@prisma/client`/`prisma` are gone
# from package.json (the content database and the admin CMS it backed are
# deleted outright, not just disconnected — this site is now a pure
# read/write client of the CRM's public API). `openssl` was specifically
# for Prisma's native query-engine binary on Alpine; Node bundles its own
# OpenSSL for the outbound HTTPS calls this app still makes (to the CRM),
# so only `ca-certificates` remains needed, for those calls' root CA trust.

# ---- deps ----
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache ca-certificates
COPY package.json package-lock.json ./
RUN npm ci

# ---- dev ----
# Used by docker-compose.yml for local development (hot reload).
FROM node:22-alpine AS dev
WORKDIR /app
RUN apk add --no-cache ca-certificates
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---- build ----
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache ca-certificates
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- production runner ----
FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache ca-certificates
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Requires `output: 'standalone'` in next.config.ts for these paths to exist.
# This three-COPY layout (public + standalone root + .next/static) is mirrored by
# scripts/start-standalone.mjs, which is what the Playwright suite boots — so the
# layout itself is exercised on every E2E run even though this image is not.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]

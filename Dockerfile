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

# Build-time env fix (2026-10-27) — Railway only passes a variable into a
# Docker build if the Dockerfile declares it with ARG; this stage had none,
# so Railway's build-time CRM_API_URL (set to the public
# https://crm.gurujitravelyatra.com/api, per .env.example's own guidance)
# never reached `npm run build` at all — the process saw nothing, fell back
# to CRM_API_URL's code-level default (the Railway-INTERNAL address, which
# does not resolve during a build), and relied entirely on
# withBuildPhaseFallback() (src/server/crm/client.ts) rather than ever
# fetching real data at build time. That fallback still makes the build
# succeed, but it means every NEXT_PUBLIC_* value below was ALSO silently
# empty in the built client bundle up to this point (confirmed by rebuilding
# locally with each one unset vs. set to a marker value, then grepping the
# resulting .next/static bundle) — most seriously,
# NEXT_PUBLIC_TURNSTILE_SITE_KEY baked in as empty meant the Turnstile
# widget never rendered at all, so no enquiry/brochure/group-reservation/
# custom-trip submission could ever pass its required verification step in
# production. See this commit's own message for the other two.
#
# ONLY the four build-time values from .env.example — never
# WEBSITE_API_KEY or WEBSITE_REVALIDATE_SECRET, which are runtime-only
# secrets Railway injects into the RUNNING container (see the `runner`
# stage below), never baked into this image or any layer of it.
ARG CRM_API_URL
ENV CRM_API_URL=$CRM_API_URL
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_MEDIA_HOST
ENV NEXT_PUBLIC_MEDIA_HOST=$NEXT_PUBLIC_MEDIA_HOST
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY

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

# syntax=docker/dockerfile:1

# FIXED 2026-10-10 — this file was authored with no Docker available to test
# it, and it failed on first real build on Railway. Two bugs, found by
# reproducing locally (removing the generated client and confirming
# `@prisma/client` fails to load, exactly as it would here):
#   1. `prisma generate` had nothing to run against: the `deps` stage only
#      copied package.json/package-lock.json before `npm ci`, so
#      `prisma/schema.prisma` didn't exist yet when @prisma/client's
#      postinstall tried to generate the client, and nothing regenerated it
#      afterward. Fixed: copy `prisma/` into `deps` before `npm ci`, plus an
#      explicit `prisma generate` in `builder` so this doesn't depend on
#      postinstall behavior at all.
#   2. Prisma's query engine needs `openssl` on Alpine (and HTTPS calls —
#      Cloudinary, the DB's TLS connection — need `ca-certificates`), and
#      neither was installed anywhere. Fixed: `apk add` in every stage that
#      installs deps or runs the app.
# Still unverified: an actual `docker build`/`docker compose up` on this
# machine (Docker remains unavailable here) — the fixes above are reasoned
# from a real local reproduction of the failure, not from a successful build.

# ---- deps ----
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl ca-certificates
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ---- dev ----
# Used by docker-compose.yml for local development (hot reload).
FROM node:22-alpine AS dev
WORKDIR /app
RUN apk add --no-cache openssl ca-certificates
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---- build ----
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl ca-certificates
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ---- production runner ----
FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl ca-certificates
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

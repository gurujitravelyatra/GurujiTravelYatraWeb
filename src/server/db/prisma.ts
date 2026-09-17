import 'server-only';
import { PrismaClient } from '@prisma/client';

/**
 * THE process-wide `PrismaClient`. One client, one connection pool, two
 * consumers.
 *
 * ## Why this file exists at all
 *
 * All of the logic below was written in, and is moved verbatim from,
 * `src/content/content-adapter.ts`, where it was correct while content was the
 * only thing this app read from Postgres. The admin CMS (Phase A) adds a second
 * consumer — `src/server/auth/*` looks up `AdminUser` — and a second
 * `new PrismaClient()` is not a second connection, it is a second POOL.
 *
 * That is not a hypothetical cost. `content-adapter.ts` already records a real
 * `P1001 Can't reach database server` failure caused by too many simultaneous
 * connection ATTEMPTS through Railway's TCP proxy during static generation. The
 * fix for that was to cap each client at a small pool; adding a whole extra
 * client would quietly undo half of it.
 *
 * So the rule is structural rather than remembered: nothing outside this file
 * calls `new PrismaClient()`. Grep for it — there should be exactly one hit here
 * and one in `prisma/seed*.ts` (standalone scripts, own process, not this pool).
 */

const globalForPrisma = globalThis as unknown as { gtyPrisma?: PrismaClient };

/**
 * Prisma sizes its connection pool at `num_cpus * 2 + 1` PER CLIENT. That default
 * assumes one client per process, which is not how this site builds: `next build`
 * static-generates the catalogue across a POOL OF WORKER PROCESSES (11 on a
 * 12-core machine), and each worker constructs its own client — so the default
 * asks the database for ~275 connections at once.
 *
 * The first build against the deployed database failed with `P1001 Can't reach
 * database server` partway through static generation for exactly this reason. The
 * server itself was not the limit (`max_connections` 500, 9 in use); the burst of
 * simultaneous CONNECTION ATTEMPTS through the managed TCP proxy was.
 *
 * A small per-client ceiling costs nothing here because these queries are a
 * handful of indexed reads per page, not a concurrent request workload.
 *
 * The operator stays in charge: an explicit `connection_limit` already present in
 * `DATABASE_URL` is left untouched.
 */
const DEFAULT_CONNECTION_LIMIT = '5';

export function buildDatasourceUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', DEFAULT_CONNECTION_LIMIT);
    }
    return url.toString();
  } catch {
    // Not parseable as a URL — hand it to Prisma untouched and let Prisma be the
    // one to report what is wrong with it, rather than masking it here.
    return rawUrl;
  }
}

/**
 * Cached on `globalThis` in EVERY environment — a deliberate change from the
 * development-only cache this code had in `content-adapter.ts`.
 *
 * The old comment's reasoning ("production gets a fresh process and skips the
 * cache") held only because production had exactly one call site, guaranteed by
 * construction: content and brochures came out of a single `createContentAdapters()`
 * pass specifically so a second call could not happen. Auth breaks that guarantee
 * — it is a genuinely separate module with its own reason to want a client — so
 * "only one call site" is no longer something the file's shape can enforce.
 *
 * Between the two risks, an unconditional cache is the safer one. In production
 * `globalThis` is process-local and the process is fresh, so caching there is a
 * module singleton with a key stable across bundler boundaries (the reason Prisma
 * documents this pattern in the first place); the thing it prevents — a second
 * pool opening under load — is the failure that has actually happened here.
 */
export function getPrismaClient(databaseUrl: string): PrismaClient {
  const existing = globalForPrisma.gtyPrisma;
  if (existing) return existing;

  const client = new PrismaClient({
    datasources: { db: { url: buildDatasourceUrl(databaseUrl) } },
  });
  globalForPrisma.gtyPrisma = client;
  return client;
}

/**
 * `null` when `DATABASE_URL` is unset.
 *
 * "No database" is a FIRST-CLASS, SUPPORTED mode here (see `content-adapter.ts`):
 * it is the mode `npm test`, `next build` and the Playwright suite all run in, and
 * the site serves the fixture catalogue in it. Returning `null` rather than
 * throwing keeps that true, and forces every caller to say out loud what it does
 * without a database — the content adapter serves fixtures, and auth refuses every
 * login (`src/server/auth/admin-user.ts`), which is the only safe reading of
 * "I cannot check this password".
 */
export function getOptionalPrismaClient(): PrismaClient | null {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return null;
  return getPrismaClient(databaseUrl);
}

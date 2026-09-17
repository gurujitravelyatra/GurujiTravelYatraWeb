import type { BrochurePort, ContentPort } from './ports';
import { getPrismaClient } from '@/server/db/prisma';
import { FixtureContentAdapter } from './adapters/fixture-content-adapter';
import { PrismaContentAdapter } from './adapters/prisma-content-adapter';

/**
 * COMPOSITION ROOT for content reads.
 *
 * This is the ONE place that decides which `ContentPort` implementation the site
 * runs on. Pages and components import `contentAdapter` from here and never
 * import an adapter directly — that is what makes swapping implementations a
 * one-file change, and it is the property that has to survive the ERP migration
 * (BLOCKERS.md §5's exit plan).
 *
 * Previously this lived at the bottom of `fixture-content-adapter.ts`, which was
 * fine while there was one implementation and actively misleading once there were
 * two — a file named for the fixtures cannot be the thing that chooses Postgres.
 * Moving it changed page IMPORT LINES only; no page logic, markup or call
 * signature was touched.
 *
 * ## Why `DATABASE_URL` decides
 *
 * Not a feature-flag system — nobody asked for one, and there is nothing to
 * toggle at runtime. It is the honest reading of a single fact: with no database
 * configured, the Prisma adapter cannot answer a single query, so the only
 * correct behaviour is to serve the fixtures.
 *
 * This makes "no database" a FIRST-CLASS, SUPPORTED mode rather than a broken
 * one, which matters because it is the mode `npm test`, `npm run build` and the
 * Playwright suite all run in today. Those suites passing is therefore evidence
 * about the fixture path and says NOTHING about the Prisma path — see
 * BLOCKERS.md item 10, which records that the database code has never touched a
 * real Postgres.
 */

/**
 * ## Where the `PrismaClient` went
 *
 * The client construction, the `globalThis` cache and the `connection_limit`
 * ceiling that used to live here are now in `src/server/db/prisma.ts`, unchanged
 * in behaviour except that the cache is no longer development-only (that file
 * explains why). They moved because content is no longer the only consumer: the
 * admin CMS reads `AdminUser` through the same database, and a second
 * `new PrismaClient()` would be a second connection POOL — the precise shape of
 * the `P1001` build failure those comments were written about.
 *
 * Nothing about this file's contract changed. `DATABASE_URL` still decides, the
 * fixture fallback is still a supported mode, and both ports still come out of
 * one construction pass.
 */

/**
 * Both ports come out of ONE construction pass, and that is load-bearing.
 *
 * `PrismaContentAdapter` implements `ContentPort` AND `BrochurePort`, so the two
 * exports below are the SAME OBJECT holding the SAME `PrismaClient`. Building
 * them in two separate calls would be the obvious-looking mistake: outside
 * development `getPrismaClient()` deliberately does not populate the
 * `globalThis` cache (production gets a fresh process and should not leak a
 * client into a global), so a second call there constructs a SECOND client with
 * a SECOND connection pool. That is the same failure mode as the build-time
 * burst documented above, just arrived at from a different direction — so the
 * number of call sites is kept at exactly one, structurally, rather than by
 * remembering not to add another.
 */
interface ContentAdapters {
  content: ContentPort;
  /**
   * NULL when no database is configured. Brochures are database-only: there is
   * no brochure fixture (see the `BrochurePort` note in `ports.ts` — inventing
   * one would mean inventing brochure data), so the fixture path genuinely
   * cannot answer these queries. `null` says that plainly and forces every
   * caller to handle it, where a stub throwing "not implemented" would let a
   * caller pretend the capability exists.
   */
  brochures: BrochurePort | null;
}

function createContentAdapters(): ContentAdapters {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    /**
     * Falling back is correct locally and in CI, where there is deliberately no
     * database. In PRODUCTION it almost certainly means a missing environment
     * variable — and the failure mode is quiet: the site comes up and serves the
     * fixture catalogue, so stale content looks like working content. That is
     * worse than an obvious error, so it gets said out loud.
     *
     * Deliberately a warning and not a throw: the fixtures remain the documented
     * stand-in for the unbuilt ERP content API (BLOCKERS.md §1b), so refusing to
     * boot would be this file inventing a deployment policy nobody set. If the
     * team decides a production boot without a database should hard-fail, this is
     * the line to change.
     */
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[content] DATABASE_URL is not set — serving the FIXTURE catalogue, not the content database. ' +
          'Tour, destination, group-departure and brochure content will be the checked-in fixtures. ' +
          'If this is production, this is almost certainly a missing environment variable.'
      );
    }
    return { content: new FixtureContentAdapter(), brochures: null };
  }
  const adapter = new PrismaContentAdapter(getPrismaClient(databaseUrl));
  return { content: adapter, brochures: adapter };
}

const adapters = createContentAdapters();

export const contentAdapter: ContentPort = adapters.content;

/**
 * `null` when `DATABASE_URL` is unset — see `ContentAdapters.brochures`. The
 * brochure API route reports this as an unconfigured capability (503), never as
 * "this tour has no brochure" (404): the two mean different things and a
 * consumer that conflates them would cache an absence that is really an outage.
 */
export const brochureAdapter: BrochurePort | null = adapters.brochures;

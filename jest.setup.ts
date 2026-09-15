import '@testing-library/jest-dom';

/**
 * Unit tests run on the FIXTURE content path, never against a database.
 *
 * `next/jest` loads `.env` into `process.env`, so a developer who has set up the
 * local Postgres (BLOCKERS.md §5) would otherwise have `DATABASE_URL` defined
 * here — and `src/content/content-adapter.ts` would compose
 * `PrismaContentAdapter`, pointing the whole suite at a database that may be
 * empty, stale, or absent. The suite would then pass or fail depending on
 * whether someone had run `docker compose up`, which is not a property a unit
 * test should have.
 *
 * Deleting it makes the fixture path unconditional and the suite hermetic. The
 * Prisma path is covered deliberately instead, with a mocked client:
 * `src/content/adapters/__tests__/prisma-content-adapter.test.ts` and
 * `src/content/__tests__/content-adapter.test.ts` (which sets this variable
 * itself, per test, to exercise both branches of the composition root).
 *
 * A second reason this must go: `testEnvironment` is jsdom, and `@prisma/client`
 * resolves to its browser build there, which throws on first use by design.
 */
delete process.env.DATABASE_URL;

/**
 * ⚠️ THIS DELETE IS NOT AIRTIGHT, AND THE HOLE IS NOT THEORETICAL.
 *
 * Importing `@prisma/client` RE-LOADS `.env` as a side effect, putting
 * `DATABASE_URL` straight back into `process.env` — after this file has run,
 * because setup files run before the test module's imports are evaluated.
 * Verified directly: in a `@jest-environment node` test the variable reads
 * `undefined` before `await import('@prisma/client')` and is set immediately
 * after.
 *
 * It has been harmless so far only because `testEnvironment` is jsdom, where
 * `@prisma/client` resolves to its browser build and is never really loaded (see
 * the note above). The guarantee therefore silently does NOT hold for any test
 * that opts into `@jest-environment node` AND transitively imports the
 * composition root — which is every API route handler under `src/app/api`.
 *
 * The first such tests (`src/app/api/__tests__/content-routes.test.ts`) were
 * found to be running against the LIVE remote Postgres, taking ~18s and
 * depending on rows in a shared database. They now pin the composition root with
 * an explicit `jest.mock('@/content/content-adapter', ...)` returning a
 * `FixtureContentAdapter`.
 *
 * So: if you write a node-environment test that touches content, do not rely on
 * this delete — mock the composition root explicitly. A node-env content test
 * that suddenly takes seconds is the tell that it is talking to Railway.
 */

/**
 * jsdom does not implement `matchMedia`. Both `useMediaQuery`
 * (src/hooks/use-media-query.ts) and framer-motion's `useReducedMotion`
 * (used by ModalShell/LeadModal) call it unconditionally, so every test that
 * renders those needs it defined even when a given test doesn't care about
 * its result. Default: nothing matches (no reduced motion, no breakpoint
 * hit). Individual tests override `window.matchMedia` when they need a
 * specific query to match.
 */
if (typeof window !== 'undefined') {
  window.matchMedia =
    window.matchMedia ||
    function matchMediaMock(query: string): MediaQueryList {
      return {
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      } as unknown as MediaQueryList;
    };
}

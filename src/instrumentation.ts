/**
 * Brief Part 1, item 3 (2026-11-14): "Fixtures/mocks may exist ONLY for unit
 * tests and only when USE_FIXTURES=1 is set explicitly... in a production
 * build/start, if USE_FIXTURES is set ... fail loudly."
 *
 * There is in fact no fixtures/mock data layer anywhere in `src/` outside
 * the test-only `FakeCrmServer` (`src/server/crm/test-support/`, imported
 * by Jest suites alone, never by application code) — confirmed by grep
 * before writing this. `USE_FIXTURES` is read nowhere today, so this is a
 * pure tripwire against someone wiring one in later and forgetting to gate
 * it: if that ever happens and USE_FIXTURES is set in production, the app
 * refuses to start rather than silently serving fixture data to a real
 * visitor.
 *
 * `register()` is Next's documented startup hook — runs once when the
 * server process starts (`next start`/the standalone server), not during
 * `next build`'s page-evaluation pass, so this cannot interact with the
 * CRM-build-phase-fallback machinery `src/server/crm/client.ts` already
 * has for THAT separate problem.
 */
export function register() {
  if (process.env.NODE_ENV === 'production' && process.env.USE_FIXTURES) {
    throw new Error(
      'USE_FIXTURES is set in a production environment. Fixtures are for unit tests only ' +
        'and must never reach a real deployment — unset USE_FIXTURES to start this server.'
    );
  }
}

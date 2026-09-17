import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 3100);
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * E2E runs against a real production build rather than `next dev`, so the
 * golden paths exercise the same Server / Client Component split, static
 * params and bundling that ship.
 *
 * Specifically it runs the **standalone** server (`npm start` ->
 * scripts/start-standalone.mjs), which is the one ./Dockerfile actually
 * deploys. This previously ran `next start`, which Next rejects under
 * `output: "standalone"` ("next start" does not work with "output: standalone"
 * configuration) — it fell back to a non-standalone server, so the suite was
 * green against a server production never runs and could not catch a
 * standalone-only regression such as a dependency missed by output file
 * tracing.
 *
 * `testDir: './e2e'` keeps Playwright away from `src/**\/__tests__` (Jest's
 * territory) and — like jest.config.ts's `roots` — away from the unrelated
 * projects checked out under `.claude/worktrees`.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  /**
   * Capped at 2. A single `next start` process serving one machine's worth of
   * default workers starved page loads badly enough that `page.goto` blew the
   * 30s default waiting for the `load` event — a harness artefact, not a site
   * problem (the server answers HTML in ~60ms and the optimized logo in
   * ~700ms when not contended).
   */
  workers: 2,
  timeout: 60_000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    navigationTimeout: 45_000,
    // The lead adapter deliberately simulates a 900ms round-trip, so a few
    // assertions legitimately wait longer than Playwright's 5s default.
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Self-contained so `npm run test:e2e` works from a cold checkout.
    command: 'npm run build && npm start',
    // PORT/HOSTNAME are passed as env rather than CLI flags because the
    // standalone entrypoint takes no arguments — it reads both from the
    // environment, exactly as the Dockerfile's `ENV PORT=3000` does.
    env: {
      PORT: String(PORT),
      HOSTNAME: '127.0.0.1',
      /**
       * The admin area refuses to issue a session without this
       * (`assertAuthSecretConfigured`), and the standalone server runs with
       * `NODE_ENV=production`, so without it every `/admin` request 500s and the
       * auth suite fails for a reason that has nothing to do with auth.
       *
       * Hardcoding it here is safe and deliberate: it is a throwaway signing key
       * for a server that exists for the duration of a test run on 127.0.0.1. It
       * is NOT a credential — it grants nothing, it is visible in the repository
       * by design, and that visibility is exactly why a real deployment must set
       * its own. Supplying it here is what keeps `npm run test:e2e` working from
       * a cold checkout with no `.env` at all.
       */
      AUTH_SECRET: 'e2e-only-auth-secret-throwaway-do-not-use-anywhere-else',
    },
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});

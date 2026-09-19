import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 3100);
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * The signing key the E2E server runs on, exported so a test can MINT a session
 * token rather than sign in with a credential.
 *
 * `admin-csrf.spec.ts` needs an authenticated request to observe the layer that
 * only runs for one (Next's Server Action origin check sits behind `proxy.ts`,
 * which bounces an anonymous POST first). Minting is the right tool because this
 * app's sessions are stateless JWTs with no database lookup — a token signed with
 * this key IS a valid session, which is a property of the design rather than a
 * hole opened for testing, and it is why the suite needs no seeded account.
 *
 * Safe and deliberate: a throwaway key for a server that exists for the duration
 * of a test run on 127.0.0.1. It grants nothing anywhere else, it is visible in
 * this repository by design, and that visibility is exactly why a real deployment
 * must set its own `AUTH_SECRET`.
 */
export const E2E_AUTH_SECRET = 'e2e-only-auth-secret-throwaway-do-not-use-anywhere-else';

/**
 * SENTINEL SECRETS — the environment the server under test runs with, and the
 * exact strings `admin-csrf.spec.ts` then proves never reach a client.
 *
 * ## Why this exists at all
 *
 * The first version of the leak check read `process.env` from inside the test
 * and asserted that nothing in it appeared in a response. It passed, and it was
 * worth nothing: the Playwright RUNNER is a different process from the server
 * and loads no `.env`, so the list it built was empty and the loop asserted over
 * zero values. A security test that passes because it checked nothing is worse
 * than no test, because it reads as coverage in a report.
 *
 * Planting the values from here fixes that at the root. The runner knows each
 * string because it is written here; the server has each string because this
 * same object is spread into `webServer.env` below. There is no channel by which
 * the list can come back empty.
 *
 * ## Why these three, and why they are safe to commit
 *
 * Each stands for a class of secret the app actually handles:
 *
 *  - `AUTH_SECRET` — session signing. The highest-value secret in the app: it is
 *    forgeable-session-equivalent, and it is the ONE whose presence on the server
 *    the suite can PROVE (see `expectServerHoldsTheSentinels`), because a token
 *    minted with it is accepted by `/admin` only if the server holds the same
 *    bytes. That handshake is what makes the whole describe non-vacuous.
 *  - `CLOUDINARY_API_SECRET` — a third-party credential with write access to the
 *    media account. Set ALONE, deliberately: `resolveConfig()` requires all three
 *    Cloudinary variables, so supplying only the secret leaves
 *    `isCloudinaryConfigured()` false and changes no behaviour anywhere, while
 *    still putting a real-shaped credential in the server's environment.
 *  - `CRM_API_KEY` — an outbound integration credential. Nothing reads it today
 *    (the CRM adapter is still log-only), which is the point: it is the pure case
 *    of "a secret is in the environment" with no functional path at all.
 *
 * None is a credential. They grant nothing anywhere, they name a server that
 * lives for the length of a test run on 127.0.0.1, and their visibility here is
 * the same deliberate trade as `E2E_AUTH_SECRET` above.
 *
 * ## If you start the server yourself
 *
 * `reuseExistingServer` is true outside CI, so a manually started server is used
 * as-is and this block does NOT reach it. Start it with these values:
 *
 *   AUTH_SECRET=<E2E_AUTH_SECRET> CLOUDINARY_API_SECRET=<…> CRM_API_KEY=<…> \
 *     PORT=3100 HOSTNAME=127.0.0.1 node scripts/start-standalone.mjs
 *
 * If you forget `AUTH_SECRET`, the handshake test fails and names the problem
 * rather than letting the suite pass against a server it never checked.
 */
export const E2E_SERVER_SECRETS = {
  AUTH_SECRET: E2E_AUTH_SECRET,
  CLOUDINARY_API_SECRET: 'e2e-sentinel-cloudinary-api-secret-8f3a1c2e4b6d5a90',
  CRM_API_KEY: 'e2e-sentinel-crm-api-key-5d9b7a3f1e0c4268',
} as const;

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
       *
       * Shared with the tests through `E2E_SERVER_SECRETS` above rather than
       * repeated, so the server and the token-minting helper cannot drift apart.
       * That object also carries the other two sentinel secrets the leak check
       * proves never reach a client — see its header.
       */
      ...E2E_SERVER_SECRETS,
    },
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});

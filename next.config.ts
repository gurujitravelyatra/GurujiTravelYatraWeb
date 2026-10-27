import type { NextConfig } from "next";

/**
 * Security response headers — M10 of the 2026-09-19 independent review.
 *
 * Until this, the app sent none: every page could be framed by any site
 * (clickjacking), responses could be MIME-sniffed, and full URLs went out
 * in `Referer` to every third-party asset host.
 *
 * Deliberately NOT here:
 *  - a `script-src` Content-Security-Policy. Next inlines bootstrap scripts, so a
 *    real script policy needs per-request nonces threaded through every page,
 *    and a wrong one blanks the site. `frame-ancestors` is the only CSP
 *    directive set, because it restricts who may frame US and cannot break
 *    anything this app loads.
 *  - `Strict-Transport-Security`. HSTS is sticky in browsers for its whole
 *    `max-age`; it belongs to the deployment once the production domain and its
 *    HTTPS termination are confirmed, not to a build that also serves plain-HTTP
 *    on 127.0.0.1 for the E2E suite.
 *
 * Verified against real responses by `e2e/security-headers.spec.ts`.
 *
 * CRM-migration Step 5 removed the admin-only `ADMIN_NO_STORE` rule that
 * used to sit alongside this (`/admin`, `/admin/:path*`,
 * `/api/admin/:path*`) — the admin CMS, its session-dependent markup and
 * its proxy (`src/proxy.ts`) are deleted outright, so there is no longer a
 * surface that rule applied to.
 */
const SITEWIDE_SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Both: X-Frame-Options for older browsers, frame-ancestors for current ones
  // (which prefer it when both are present).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

const nextConfig: NextConfig = {
  /**
   * Required by the `runner` stage in ./Dockerfile, which copies
   * `.next/standalone` and `.next/static`. Without this, `next build`
   * never emits `.next/standalone` and the production image COPY fails.
   */
  output: "standalone",

  /**
   * Build-worker concurrency fix (2026-10-27) — the Railway build died
   * silently ("Build Failed ... exit code: 1", no error text) at
   * "Generating static pages (10/14)" after the two previous CRM-build
   * fixes landed. A real local build's own log named the cause before
   * this fix: `Generating static pages using 11 workers (0/14)` — 11
   * parallel worker PROCESSES, each loading the full compiled Next.js
   * runtime into memory, for a 14-page site. Railway's build machine is
   * memory-constrained enough that this is a classic OOM kill: the Linux
   * OOM killer SIGKILLs a process without writing anything Next could
   * report as an error, which is exactly why the failure showed no error
   * text — the same silent-worker-exit signature as this repo's earlier
   * memory incident.
   *
   * `cpus: 1` caps the worker pool Next spawns for build-time parallel
   * work (page compilation and static generation both use it) at a
   * single process — see node_modules/next/dist/server/config-schema.js's
   * `cpus` entry under `experimental`, confirmed present in this Next
   * version even though it has no standalone markdown doc in
   * node_modules/next/dist/docs. `staticGenerationMaxConcurrency: 1`
   * (documented: node_modules/next/dist/docs/01-app/03-api-reference/
   * 05-config/01-next-config-js/staticGeneration.md — "the maximum
   * number of pages to be processed per worker") then ensures that even
   * the one remaining worker generates pages one at a time rather than
   * batching several concurrently within itself. Together these trade
   * build WALL-CLOCK time (pages generate sequentially instead of in
   * parallel) for a memory ceiling the build machine can actually stay
   * under — the right trade for a small, infrequently-rebuilt marketing
   * site, where a slower build that succeeds beats a fast one that gets
   * OOM-killed partway through.
   */
  experimental: {
    cpus: 1,
    staticGenerationMaxConcurrency: 1,
  },

  async headers() {
    return [{ source: "/:path*", headers: SITEWIDE_SECURITY_HEADERS }];
  },
};

export default nextConfig;

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

  async headers() {
    return [{ source: "/:path*", headers: SITEWIDE_SECURITY_HEADERS }];
  },
};

export default nextConfig;

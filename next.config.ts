import type { NextConfig } from "next";

/**
 * Security response headers — M10 of the 2026-09-19 independent review.
 *
 * Until this, the app sent none: every page, including the admin login form,
 * could be framed by any site (clickjacking), responses could be MIME-sniffed,
 * and full URLs — admin paths included — went out in `Referer` to every
 * third-party asset host.
 *
 * Deliberately NOT here, and recorded as follow-ups in BLOCKERS.md item 14:
 *  - a `script-src` Content-Security-Policy. Next inlines bootstrap scripts, so a
 *    real script policy needs per-request nonces threaded through the proxy and
 *    every page, and a wrong one blanks the site. `frame-ancestors` is the only
 *    CSP directive set, because it restricts who may frame US and cannot break
 *    anything this app loads.
 *  - `Strict-Transport-Security`. HSTS is sticky in browsers for its whole
 *    `max-age`; it belongs to the deployment once the production domain and its
 *    HTTPS termination are confirmed, not to a build that also serves plain-HTTP
 *    on 127.0.0.1 for the E2E suite.
 *
 * Verified against real responses by `e2e/security-headers.spec.ts`, including
 * the `/admin` → login redirect the proxy issues, which is the response a
 * config-level header is most likely to miss.
 */
const SITEWIDE_SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Both: X-Frame-Options for older browsers, frame-ancestors for current ones
  // (which prefer it when both are present).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

/**
 * Admin responses must never be stored by a shared cache or the browser's
 * back/forward history: they carry tour drafts and session-dependent markup.
 * Next already marks dynamic pages uncacheable, but "already" is a property of
 * how each route happens to render today — this makes it a stated rule for the
 * whole surface, including API responses and redirects.
 */
const ADMIN_NO_STORE = [{ key: "Cache-Control", value: "private, no-store" }];

const nextConfig: NextConfig = {
  /**
   * Required by the `runner` stage in ./Dockerfile, which copies
   * `.next/standalone` and `.next/static`. Without this, `next build`
   * never emits `.next/standalone` and the production image COPY fails.
   */
  output: "standalone",

  async headers() {
    return [
      { source: "/:path*", headers: SITEWIDE_SECURITY_HEADERS },
      // `/admin` itself is listed separately: `/admin/:path*` does not match the
      // bare segment (the same reason `src/proxy.ts`'s matcher lists both).
      { source: "/admin", headers: ADMIN_NO_STORE },
      { source: "/admin/:path*", headers: ADMIN_NO_STORE },
      { source: "/api/admin/:path*", headers: ADMIN_NO_STORE },
    ];
  },
};

export default nextConfig;

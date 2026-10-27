import type { NextConfig } from "next";

/**
 * Parses `NEXT_PUBLIC_MEDIA_HOST` (an origin, e.g.
 * `https://media.gurujitravelyatra.com`, no path) into the `remotePatterns`
 * entries `next/image` needs — see the `images` config's own comment below
 * for why this exists at all. Returns `[]` on anything that is not a clean
 * `https://` origin (unset, malformed, or someone accidentally including a
 * path) rather than throwing and failing the build over an optional,
 * currently-unused allowlist.
 */
function buildMediaHostRemotePatterns(): NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]> {
  const raw = process.env.NEXT_PUBLIC_MEDIA_HOST;
  if (!raw) return [];

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return [];
  }
  if (url.protocol !== "https:") return [];

  return [
    { protocol: "https", hostname: url.hostname, pathname: "/place-images/**" },
    { protocol: "https", hostname: url.hostname, pathname: "/tour-images/**" },
  ];
}

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

  /**
   * Production incident 2026-10-27 (Bug 2c) — `next/image` is NOT actually
   * used anywhere in this codebase today (`PhotoPlaceholder`, the one
   * component every card/hero/rail routes an image through, deliberately
   * renders a plain `<img>` — see its own long header comment on why).
   * `isSafeMediaUrl()`/`NEXT_PUBLIC_MEDIA_HOST` (src/lib/cloudinary-url.ts)
   * is the allowlist that actually gates whether a CRM-returned media URL
   * renders at all, and it needs no config here to do that.
   *
   * Added anyway, on request, as defence-in-depth for if/when `next/image`
   * is ever adopted for these images: without this, `next/image` would
   * answer `400 Bad Request` for every allowed media URL regardless of
   * what `isSafeMediaUrl()` already permits — the two allowlists are
   * independent and both would need to agree.
   *
   * Derived from `NEXT_PUBLIC_MEDIA_HOST` itself (currently
   * `https://media.gurujitravelyatra.com`, per `.env.example`) rather than
   * a second hardcoded copy of that hostname — the two were always going
   * to need to agree, so there is exactly one place that knows it. Unset
   * is a supported mode: `remotePatterns` is simply empty, matching
   * `isSafeMediaUrl()`'s own "no R2 host configured" fallback — the build
   * does not fail either way. `pathname` covers both `/place-images/**`
   * (`CrmPlace.imageUrl`, e.g. Kedarnath's) and `/tour-images/**`
   * (`CrmTourCard.coverImageUrl`) — the two prefixes this host's real URLs
   * have actually been seen under.
   */
  images: {
    remotePatterns: buildMediaHostRemotePatterns(),
  },

  async headers() {
    return [{ source: "/:path*", headers: SITEWIDE_SECURITY_HEADERS }];
  },
};

export default nextConfig;

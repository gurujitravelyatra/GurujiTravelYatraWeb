/**
 * `next/image`'s `remotePatterns` for the CRM's R2 media host.
 *
 * Extracted out of `next.config.ts` (rather than left inline) so Jest can
 * exercise it directly — `next.config.ts` itself is never imported by a
 * test, only read by `next build`/`next dev`.
 *
 * Production incident (2026-10-28): a direct hit on
 * `/_next/image?url=<R2 URL>` answered `400 "url" parameter is not allowed`
 * even with `NEXT_PUBLIC_MEDIA_HOST` correctly set in Railway. Two causes,
 * both fixed here:
 *
 *  1. The old parser only accepted a full `https://` origin (`new URL(raw)`
 *     threw and returned `[]` for a bare host like `media.example.com`).
 *     `normalizeMediaHost` now accepts either form.
 *  2. The old `remotePatterns` only allowlisted `/place-images/**` and
 *     `/tour-images/**` — so a real R2 URL under any other folder
 *     (`/site-images/`, `/brochures/`) was never going to match, regardless
 *     of the host. `pathname: '/**'` now allows every folder under the host,
 *     since the CRM — a separate system this site does not control the
 *     write path of — can add a new folder at any time without this site
 *     needing a redeploy just to allowlist it.
 */

export interface MediaRemotePattern {
  protocol: 'https';
  hostname: string;
  pathname: '/**';
}

/**
 * The real, confirmed production R2 host — ALWAYS included, regardless of
 * what `NEXT_PUBLIC_MEDIA_HOST` resolves to. Mirrors the
 * `withFallbackAlways()` reasoning in `src/server/crm/client.ts`: a missing
 * or misconfigured env var must never be able to take images down again.
 * Listing the same host twice (this fallback + the configured value, when
 * they're equal) is harmless — `remotePatterns` is an allowlist, not an
 * exclusive/single-entry config.
 */
export const FALLBACK_MEDIA_HOST = 'media.gurujitravelyatra.com';

/**
 * Normalizes `NEXT_PUBLIC_MEDIA_HOST` into a bare hostname. Accepts both
 * `"media.example.com"` (bare host) and `"https://media.example.com/"`
 * (full origin, trailing slash and all) — the var is documented as an
 * origin, but a bare host is an easy, unenforced mistake to make when typing
 * it into Railway's dashboard, and a build must not silently lose the whole
 * allowlist over it.
 *
 * Returns `undefined` for anything genuinely unusable (empty/unset, or an
 * `http://` origin — R2 is https-only) rather than throwing, matching every
 * other env-var reader in this codebase ("unset is a supported mode").
 */
export function normalizeMediaHost(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'https:') return undefined;
  if (!url.hostname) return undefined;

  return url.hostname;
}

/**
 * Builds the full `remotePatterns` array: the hard-coded fallback host plus
 * whatever `rawMediaHost` resolves to (deduplicated), each allowing every
 * path under it.
 */
export function buildMediaHostRemotePatterns(rawMediaHost: string | undefined | null): MediaRemotePattern[] {
  const hosts = new Set<string>([FALLBACK_MEDIA_HOST]);

  const configured = normalizeMediaHost(rawMediaHost);
  if (configured) hosts.add(configured);

  return Array.from(hosts).map((hostname) => ({
    protocol: 'https' as const,
    hostname,
    pathname: '/**' as const,
  }));
}

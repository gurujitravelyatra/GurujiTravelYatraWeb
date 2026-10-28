/**
 * THE single source of truth for "which R2 media host(s) does this site
 * trust", shared by `next.config.ts`'s `remotePatterns` (via
 * `media-remote-patterns.ts`) and `cloudinary-url.ts`'s render-time
 * `isSafeMediaUrl` allowlist.
 *
 * Production incident (2026-10-28, round 2): after `next.config.ts`'s
 * `remotePatterns` parser was fixed to accept `NEXT_PUBLIC_MEDIA_HOST`
 * with or without `https://`, `/_next/image` started returning 200 — but
 * every card/hero still rendered the placeholder, because
 * `cloudinary-url.ts` had its OWN, separate, STRICTER parser
 * (`rawMediaHost.replace(/\/+$/, '') + '/'`) that required the env var to
 * already include `https://`. Two independent parsers of the same env var
 * drifting apart is exactly the bug class this file exists to close off —
 * see `media-remote-patterns.ts` and `cloudinary-url.ts`, both of which now
 * import from here instead of each parsing `NEXT_PUBLIC_MEDIA_HOST`
 * themselves.
 */

/**
 * The real, confirmed production R2 host — ALWAYS trusted, regardless of
 * what `NEXT_PUBLIC_MEDIA_HOST` resolves to. Mirrors the
 * `withFallbackAlways()` reasoning in `src/server/crm/client.ts`: a missing
 * or misconfigured env var must never be able to take real images down.
 */
export const FALLBACK_MEDIA_HOST = 'media.gurujitravelyatra.com';

/**
 * Normalizes `NEXT_PUBLIC_MEDIA_HOST` into a bare hostname. Accepts both
 * `"media.example.com"` (bare host) and `"https://media.example.com/"`
 * (full origin, trailing slash and all) — the var is documented as an
 * origin, but a bare host is an easy, unenforced mistake to make typing it
 * into a dashboard, and that mistake must degrade to "allowlist unaffected"
 * (the hard-coded fallback still works), never to "every real image breaks".
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
 * Every hostname this site trusts media from: the hard-coded fallback plus
 * whatever `rawMediaHost` resolves to, deduplicated. Both `next.config.ts`'s
 * `remotePatterns` and `cloudinary-url.ts`'s render-time allowlist are built
 * from exactly this list, so they can never disagree about which host is
 * trusted — only about what they each additionally require of the request
 * (a path, in the `next/image` case; an exact `https://` prefix, in the
 * render-time case).
 */
export function getAllowedMediaHostnames(rawMediaHost: string | undefined | null): string[] {
  const hosts = new Set<string>([FALLBACK_MEDIA_HOST]);
  const configured = normalizeMediaHost(rawMediaHost);
  if (configured) hosts.add(configured);
  return Array.from(hosts);
}

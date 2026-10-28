import { getAllowedMediaHostnames } from './media-host';

/**
 * `next/image`'s `remotePatterns` for the CRM's R2 media host.
 *
 * Extracted out of `next.config.ts` (rather than left inline) so Jest can
 * exercise it directly — `next.config.ts` itself is never imported by a
 * test, only read by `next build`/`next dev`.
 *
 * The actual host allowlist lives in `media-host.ts` and is shared with
 * `cloudinary-url.ts`'s render-time check — see that file's header for why
 * having two independent copies of this logic was itself the bug in the
 * 2026-10-28 round-2 incident. This module only adds what is specific to
 * `next/image`: the `protocol`/`pathname` shape `remotePatterns` needs.
 * `pathname: '/**'` allows every folder under the host (`/place-images/`,
 * `/tour-images/`, `/site-images/`, `/brochures/`, and whatever the CRM adds
 * next) — the CRM is a separate system this site does not control the write
 * path of, so a new folder there must not need a website redeploy just to
 * be allowlisted.
 */

export interface MediaRemotePattern {
  protocol: 'https';
  hostname: string;
  pathname: '/**';
}

export function buildMediaHostRemotePatterns(rawMediaHost: string | undefined | null): MediaRemotePattern[] {
  return getAllowedMediaHostnames(rawMediaHost).map((hostname) => ({
    protocol: 'https' as const,
    hostname,
    pathname: '/**' as const,
  }));
}

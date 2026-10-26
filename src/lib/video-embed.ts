/**
 * Render-time refusal for `site.settings.profileVideoUrl` (`GET /public/site`),
 * same reasoning as `isSafeMediaUrl` in `cloudinary-url.ts`: a value read from
 * the CRM and put straight into an `<iframe src>` is untrusted input to the
 * renderer no matter how much the write side is trusted, and an `<iframe>` is
 * a much larger attack surface than an `<img>` (it can run script, layer a
 * phishing overlay, or clickjack the page beneath it).
 *
 * Allowlist, not a blocklist: only the two embeddable-video hosts this field
 * is ever expected to hold.
 */
const ALLOWED_EMBED_PREFIXES = ['https://www.youtube.com/embed/', 'https://player.vimeo.com/video/'];

export function isSafeVideoEmbedUrl(url: string | null | undefined): boolean {
  if (typeof url !== 'string' || url.length === 0) return false;
  return ALLOWED_EMBED_PREFIXES.some((prefix) => url.startsWith(prefix));
}

export function safeVideoEmbedUrl(url: string | null | undefined): string | undefined {
  return isSafeVideoEmbedUrl(url) ? (url as string) : undefined;
}

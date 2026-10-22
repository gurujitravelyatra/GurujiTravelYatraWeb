/**
 * Cloudinary delivery-URL transformations, done by string surgery.
 *
 * NOT `server-only` and importing nothing: the admin editor's previews and the
 * public cards both need this, and it must not pull the Cloudinary SDK (and with
 * it the API secret's module) anywhere near a client bundle. Building a delivery
 * URL needs no credentials — that is the whole point of Cloudinary's URL-based
 * transformation API — so the SDK would buy nothing and cost a great deal.
 *
 * ## Why every function here falls back to the input unchanged
 *
 * These run over a `Tour.coverImageUrl` read from the database, and the shape of
 * that string is not guaranteed: it could be an asset uploaded before a folder
 * convention changed, a URL pasted in by hand, or — the case that matters — a
 * perfectly valid Cloudinary URL whose path this parser does not anticipate.
 * A transformation helper that returned null or threw on an unfamiliar URL would
 * turn "the thumbnail is full-size" into "the image is missing", which is a much
 * worse outcome for a cosmetic optimisation. So the contract is: improve the URL
 * when it is recognised, return it untouched when it is not.
 */

/**
 * The host every legitimate media URL in this project starts with.
 *
 * Duplicated deliberately from `CLOUDINARY_URL_PREFIX` in
 * `tour-form-schema.ts` rather than imported: that module lives under
 * `src/server/admin/`, and a PUBLIC page importing from the admin tree would
 * invert the one-way boundary `tour-repository.ts` documents at length. The two
 * constants are pinned to each other by a test instead, which is the cheaper
 * side of that trade.
 */
const CLOUDINARY_DELIVERY_PREFIX = 'https://res.cloudinary.com/';

/**
 * The R2 media host, for the CRM migration — CRM-migration decision 4.
 *
 * Read from `NEXT_PUBLIC_MEDIA_HOST`, an env var rather than a hard-coded
 * string, because the final R2 address is not confirmed yet. `NEXT_PUBLIC_`
 * on purpose: this is a public CDN domain, not a credential, so inlining it
 * into the browser bundle is the correct and intended behaviour, not a leak.
 *
 * EXACT HOST ONLY, no wildcard — the same allowlist reasoning
 * `CLOUDINARY_DELIVERY_PREFIX` already uses, and for the same reason the test
 * below pins: a wildcard/suffix match is exactly what lets
 * `res.cloudinary.com.evil.example` through.
 *
 * UNSET IS A SUPPORTED MODE. `next build` must not fail because this is
 * missing — nothing here throws or reads the var at import time in a way
 * that could — and a URL that would have matched the R2 host simply fails
 * `isSafeMediaUrl` like any other unrecognised URL, which `PhotoPlaceholder`
 * already turns into its neutral placeholder box rather than a broken image
 * or a render error.
 */
const rawMediaHost = process.env.NEXT_PUBLIC_MEDIA_HOST;
const MEDIA_HOST_PREFIX = rawMediaHost ? `${rawMediaHost.replace(/\/+$/, '')}/` : undefined;

/** Every host prefix a stored media URL may legitimately start with. */
function allowedMediaPrefixes(): readonly string[] {
  return MEDIA_HOST_PREFIX ? [CLOUDINARY_DELIVERY_PREFIX, MEDIA_HOST_PREFIX] : [CLOUDINARY_DELIVERY_PREFIX];
}

/**
 * RENDER-TIME URL REFUSAL — defence in depth, added after the 2026-09-19 review.
 *
 * ## The hole
 *
 * `/tour-packages/[slug]` rendered `<a href={url}>` straight from
 * `pkg.galleryImageUrls`, and `PhotoPlaceholder` renders `<img src>` the same
 * way. Both trusted the database.
 *
 * Every WRITE path already pins these to Cloudinary — `cloudinaryUrl` in
 * `tour-form-schema.ts` refuses anything else, which is why a `javascript:` URL
 * cannot be saved through the admin. But "cannot be saved through the admin" is
 * not "is not in the database". A direct SQL edit, a restore from a backup taken
 * before that rule existed, or any future import script puts a value in the
 * column that no validator ever saw — and the render site would have turned a
 * `javascript:` gallery URL into a live link, on a public page, for every
 * visitor.
 *
 * That is the same reasoning `sanitize-tour-text.ts` gives for cleaning at write
 * time rather than trusting a renderer; this is the other half of it. A stored
 * value is untrusted input to a renderer no matter who was supposed to have
 * written it.
 *
 * ## Why a prefix check and not a scheme check
 *
 * Refusing `javascript:` and `data:` by name is a blocklist, and a blocklist of
 * URL schemes is a losing position — `vbscript:`, control characters a browser
 * strips before reading the scheme, `javascript:`. Requiring the exact
 * Cloudinary delivery prefix is an allowlist, it is what every real value
 * already satisfies, and it costs one `startsWith`.
 */
export function isSafeMediaUrl(url: string | undefined | null): boolean {
  if (typeof url !== 'string') return false;
  return allowedMediaPrefixes().some((prefix) => url.startsWith(prefix));
}

/**
 * The URL when it is safe to put in an `href`/`src`, and `undefined` when it is
 * not — so a call site that forgets to check still cannot emit it, and the
 * absent case falls through to whatever placeholder already exists.
 *
 * Returning `undefined` rather than throwing is the same call the rest of this
 * module makes: a tour with one bad URL should render without that image, not
 * 500 the whole page.
 */
export function safeMediaUrl(url: string | undefined | null): string | undefined {
  return isSafeMediaUrl(url) ? (url as string) : undefined;
}

/**
 * Matches the point in a Cloudinary delivery URL where transformations go —
 * immediately after `/<resource_type>/upload/`.
 *
 * Anchored on `res.cloudinary.com` rather than on `/upload/` alone so an
 * arbitrary URL that happens to contain `/upload/` (a WordPress media path, say)
 * is left alone instead of having a Cloudinary transformation spliced into it.
 */
const CLOUDINARY_UPLOAD_SEGMENT = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/(?:image|raw|video)\/upload\/)(.+)$/;

export interface ThumbnailOptions {
  width: number;
  height: number;
}

/**
 * A cropped, auto-formatted thumbnail of a Cloudinary image.
 *
 * `c_fill` + explicit dimensions, `g_auto` to keep the subject in frame when
 * cropping, `q_auto` and `f_auto` so Cloudinary picks the codec and quality for
 * the requesting browser. This is the one place the "automatic image
 * optimisation" the platform was chosen for is actually asked for — an untouched
 * `secure_url` delivers the original 4 MB JPEG to a 240px slot.
 */
export function cloudinaryThumbnailUrl(url: string, { width, height }: ThumbnailOptions): string {
  const match = CLOUDINARY_UPLOAD_SEGMENT.exec(url);
  if (!match) return url;

  const [, prefix, rest] = match;

  // Raw resources (the brochure PDFs) are not transformable. Splicing image
  // transformations onto one produces a URL that 404s.
  if (prefix.includes('/raw/upload/')) return url;

  return `${prefix}c_fill,g_auto,w_${width},h_${height},q_auto,f_auto/${rest}`;
}

/**
 * The same image, optimised but NOT cropped — for the full-bleed card and hero
 * slots where the layout, not the URL, decides the crop.
 *
 * `w_` with no `c_fill` caps the delivered width; `q_auto,f_auto` do the format
 * and quality work. Deliberately no height and no gravity: constraining both
 * axes here would crop a cover image the admin framed deliberately.
 */
export function cloudinaryDisplayUrl(url: string, maxWidth: number): string {
  const match = CLOUDINARY_UPLOAD_SEGMENT.exec(url);
  if (!match) return url;

  const [, prefix, rest] = match;
  if (prefix.includes('/raw/upload/')) return url;

  return `${prefix}w_${maxWidth},c_limit,q_auto,f_auto/${rest}`;
}

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

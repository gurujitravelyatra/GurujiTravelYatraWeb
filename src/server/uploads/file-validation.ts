/**
 * What may be uploaded through `/api/admin/uploads`, and how that is decided.
 *
 * Deliberately NOT `server-only`, and deliberately free of any Node or Cloudinary
 * import. Two consumers share it on purpose, exactly as `tour-form-schema.ts` is
 * shared between the tour form and the action that persists it:
 *
 *  - the admin form, for the `accept` attribute and a friendly "that file is
 *    23 MB" message before anything is sent over a hotel wifi connection;
 *  - the route handler, which re-runs the whole thing over the real bytes.
 *
 * The client's copy is a COURTESY. Nothing it does is trusted: `/api/admin/
 * uploads` is a POST endpoint reachable with curl, and `accept="image/*"` is a
 * file-picker filter, not a check — it is trivially bypassed by dragging a file
 * in, and does not exist at all for a request that never touched a browser.
 *
 * ## Why the bytes are sniffed and not the MIME type
 *
 * Both the filename extension and the `Content-Type` of a multipart part are
 * supplied by the CLIENT. Renaming `payload.svg` to `photo.jpg` changes both, at
 * no cost and with no tooling. An SVG accepted as an image is a stored-XSS
 * vector the moment it is served from a domain a browser trusts, and the
 * "images only" rule that reads the client's own claim about the file is the
 * rule that lets it through.
 *
 * So the ONLY thing that decides a file's type here is its leading bytes — the
 * one part of the upload the client cannot restate. The declared MIME type is
 * still read, but only to produce a clearer error when the two DISAGREE; it can
 * never be what admits a file.
 *
 * ## Why a magic-byte check is enough for this surface
 *
 * It is not a virus scanner and does not claim to be. It establishes that the
 * file is structurally the format it claims, which is what stops the realistic
 * attacks on an image field (SVG/HTML smuggled in as an image, an executable
 * with a `.jpg` name) and stops the realistic accidents (an admin picking a
 * `.heic` off a phone and getting a broken card two days later). Deep content
 * validation belongs to Cloudinary, which re-decodes every image it accepts and
 * rejects what it cannot parse — a second, independent check on the far side.
 */

export const UPLOAD_KINDS = ['cover', 'gallery', 'brochure'] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

export function isUploadKind(value: unknown): value is UploadKind {
  return typeof value === 'string' && (UPLOAD_KINDS as readonly string[]).includes(value);
}

/** The formats a tour image may be in. No SVG, no GIF — see the module note. */
export type ImageFormat = 'jpeg' | 'png' | 'webp';
export type DetectedFormat = ImageFormat | 'pdf';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_BROCHURE_BYTES = 20 * 1024 * 1024;

/** `accept` attributes for the file inputs. A filter, never a check. */
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';
export const BROCHURE_ACCEPT = 'application/pdf';

export const IMAGE_FORMAT_LABEL = 'JPG, PNG or WebP';

export function maxBytesFor(kind: UploadKind): number {
  return kind === 'brochure' ? MAX_BROCHURE_BYTES : MAX_IMAGE_BYTES;
}

/** "10 MB" / "2.4 MB" — for messages and for the file list in the editor. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  // One decimal below 10 MB, none above — "9.4 MB" is useful, "14.2 MB" is noise.
  return mb < 10 ? `${mb.toFixed(1)} MB` : `${Math.round(mb)} MB`;
}

/**
 * How many leading bytes the sniffer needs. WebP is the long one: its marker sits
 * at offset 8 inside a RIFF container, so 12 bytes are required before a WebP can
 * be distinguished from any other RIFF file (a .wav, for instance).
 */
export const MAGIC_BYTE_PREFIX_LENGTH = 12;

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

const JPEG_SOI = [0xff, 0xd8, 0xff] as const;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const RIFF = [0x52, 0x49, 0x46, 0x46] as const; // "RIFF"
const WEBP = [0x57, 0x45, 0x42, 0x50] as const; // "WEBP", at offset 8
const PDF_HEADER = [0x25, 0x50, 0x44, 0x46, 0x2d] as const; // "%PDF-"

/**
 * The file's real format from its leading bytes, or null if it is none of the
 * four we accept.
 *
 * Null is the honest answer for "something else" — it deliberately does not try
 * to name what the file actually was. Reporting "this looks like an SVG" would
 * mean maintaining signatures for formats we reject, and the answer the admin
 * needs is the same either way: this is not one of the accepted formats.
 */
export function detectFormat(bytes: Uint8Array): DetectedFormat | null {
  if (startsWith(bytes, JPEG_SOI)) return 'jpeg';
  if (startsWith(bytes, PNG_SIGNATURE)) return 'png';
  if (startsWith(bytes, RIFF) && startsWith(bytes, WEBP, 8)) return 'webp';
  if (startsWith(bytes, PDF_HEADER)) return 'pdf';
  return null;
}

export type UploadRejectionCode =
  | 'EMPTY_FILE'
  | 'TOO_LARGE'
  | 'UNRECOGNISED_FORMAT'
  | 'WRONG_FORMAT_FOR_KIND';

export type UploadValidation =
  | { ok: true; format: DetectedFormat }
  | { ok: false; code: UploadRejectionCode; message: string };

export interface UploadCandidate {
  /** The file's own bytes. `byteLength` is the size that is checked — not any client-declared one. */
  byteLength: number;
  /** At least {@link MAGIC_BYTE_PREFIX_LENGTH} leading bytes. */
  head: Uint8Array;
  /** Client-declared. Used ONLY to sharpen an error message. Never to admit a file. */
  declaredMimeType?: string;
  /** Client-declared. Same rule as `declaredMimeType`. */
  fileName?: string;
}

/**
 * The whole rule set, in the order that produces the most useful message.
 *
 * Size is checked BEFORE format so a 40 MB HEIC is reported as "too large"
 * rather than "wrong format" — the admin's next action differs, and being told
 * to convert a file that would still be rejected for its size wastes a round
 * trip.
 */
export function validateUpload(kind: UploadKind, candidate: UploadCandidate): UploadValidation {
  if (candidate.byteLength === 0) {
    return {
      ok: false,
      code: 'EMPTY_FILE',
      message: 'That file is empty (0 bytes). Check the file opens on your computer, then try again.',
    };
  }

  const limit = maxBytesFor(kind);
  if (candidate.byteLength > limit) {
    return {
      ok: false,
      code: 'TOO_LARGE',
      message: `That file is ${formatBytes(candidate.byteLength)}. The limit is ${formatBytes(limit)}.`,
    };
  }

  const format = detectFormat(candidate.head);

  if (format === null) {
    /**
     * The one place the client's declared type earns its keep. When the contents
     * are unrecognised but the NAME says `.jpg`, the admin is almost certainly
     * looking at a renamed or corrupted file and needs to be told that, rather
     * than being told their JPEG is not a JPEG and concluding the site is broken.
     */
    const claim = candidate.declaredMimeType ?? '';

    /**
     * Only a claim naming one of the four formats we ACCEPT suggests a rename.
     *
     * A broader `claim.startsWith('image/')` test was wrong and a test caught it:
     * a GIF honestly declaring `image/gif` would have been told it "may have been
     * renamed or damaged", sending the admin to re-export a file that was never
     * damaged and would be refused again. An unsupported format needs to be told
     * which formats ARE supported; a renamed one needs to be told it is not what
     * it says. The two messages are not interchangeable.
     */
    const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    const claimsAccepted =
      ACCEPTED_MIME_TYPES.includes(claim.toLowerCase()) ||
      /\.(jpe?g|png|webp|pdf)$/i.test(candidate.fileName ?? '');

    return {
      ok: false,
      code: 'UNRECOGNISED_FORMAT',
      message: claimsAccepted
        ? 'That file is named like an image or a PDF, but its contents are not one — it may have been renamed or it may be damaged. Re-export it and try again.'
        : `That file type is not accepted. Images must be ${IMAGE_FORMAT_LABEL}; a brochure must be a PDF.`,
    };
  }

  const wantsPdf = kind === 'brochure';
  const isPdf = format === 'pdf';

  if (wantsPdf !== isPdf) {
    return {
      ok: false,
      code: 'WRONG_FORMAT_FOR_KIND',
      message: wantsPdf
        ? 'The brochure must be a PDF. That file is an image — use the cover or gallery fields for images.'
        : `Images must be ${IMAGE_FORMAT_LABEL}. That file is a PDF — use the brochure field for it.`,
    };
  }

  return { ok: true, format };
}

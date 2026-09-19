import {
  MAGIC_BYTE_PREFIX_LENGTH,
  MAX_BROCHURE_BYTES,
  MAX_IMAGE_BYTES,
  detectFormat,
  formatBytes,
  isUploadKind,
  maxBytesFor,
  validateUpload,
  type UploadCandidate,
  type UploadKind,
} from '../file-validation';

/**
 * What may be uploaded, and — the part that matters — what a LIE about a file
 * cannot get past.
 *
 * The threat these tests pin is not an admin picking the wrong file. It is that
 * `Content-Type` and the filename extension are both written by the client, so
 * any rule that reads them is a rule an attacker restates for free. Every
 * "rejects X" case below therefore ships X with the most convincing possible
 * claim attached — `image/jpeg`, named `.jpg` — and asserts it is refused anyway.
 */

/** Real leading bytes for each format the validator accepts. */
const JPEG_HEAD = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01];
const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d];
// "RIFF" .... "WEBP" — the marker sits at offset 8, which is why 12 bytes are read.
const WEBP_HEAD = [0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];
const PDF_HEAD = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25, 0xe2, 0xe3];

/** An SVG — a valid image to a human, a script host to a browser. */
const SVG_HEAD = Array.from('<svg xmlns=', (character) => character.charCodeAt(0));
/** A Windows executable. */
const EXE_HEAD = [0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00];
/** A GIF — a real image format, and one this project deliberately does not accept. */
const GIF_HEAD = Array.from('GIF89a', (character) => character.charCodeAt(0)).concat([0, 0, 0, 0, 0, 0]);
/** A RIFF container that is NOT a WebP — a .wav. Proves the offset-8 check does work. */
const WAV_HEAD = [0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45];

function candidate(head: number[], overrides: Partial<UploadCandidate> = {}): UploadCandidate {
  return {
    byteLength: 1024,
    head: new Uint8Array(head),
    ...overrides,
  };
}

describe('detectFormat reads the bytes, and only the bytes', () => {
  it.each([
    ['jpeg', JPEG_HEAD],
    ['png', PNG_HEAD],
    ['webp', WEBP_HEAD],
    ['pdf', PDF_HEAD],
  ])('recognises %s', (expected, head) => {
    expect(detectFormat(new Uint8Array(head))).toBe(expected);
  });

  it.each([
    ['an SVG', SVG_HEAD],
    ['an executable', EXE_HEAD],
    ['a GIF', GIF_HEAD],
    ['a RIFF container that is not WebP', WAV_HEAD],
  ])('returns null for %s', (_label, head) => {
    expect(detectFormat(new Uint8Array(head))).toBeNull();
  });

  it('does not mistake a truncated RIFF header for a WebP', () => {
    // Fewer than 12 bytes cannot prove WEBP, and guessing would admit any RIFF
    // file. Absence of proof is a rejection here, not a benefit of the doubt.
    expect(detectFormat(new Uint8Array(WEBP_HEAD.slice(0, 8)))).toBeNull();
  });

  it('returns null for an empty buffer rather than throwing', () => {
    expect(detectFormat(new Uint8Array([]))).toBeNull();
  });
});

describe('a spoofed MIME type or extension cannot admit a file', () => {
  /**
   * The central case. Every one of these is refused, and the reason it is refused
   * is that its CONTENTS are not an accepted format — not that anything about its
   * name or declared type gave it away, because in each case both of those say
   * "this is a perfectly ordinary JPEG".
   */
  it.each([
    ['an SVG renamed to .jpg', SVG_HEAD],
    ['an executable renamed to .jpg', EXE_HEAD],
    ['a GIF renamed to .jpg', GIF_HEAD],
  ])('rejects %s even though it declares image/jpeg', (_label, head) => {
    const result = validateUpload('cover', candidate(head, { declaredMimeType: 'image/jpeg', fileName: 'holiday.jpg' }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('UNRECOGNISED_FORMAT');
  });

  it('rejects an HTML file declaring application/pdf and named .pdf', () => {
    const html = Array.from('<!DOCTYPE html>', (character) => character.charCodeAt(0));
    const result = validateUpload(
      'brochure',
      candidate(html, { declaredMimeType: 'application/pdf', fileName: 'itinerary.pdf' })
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('UNRECOGNISED_FORMAT');
  });

  it('ACCEPTS a real JPEG whose declared type is wrong or missing', () => {
    // The mirror image, and the proof that the MIME type is not consulted to
    // admit a file either. A real JPEG from a client that mislabels it is still
    // a real JPEG.
    for (const declaredMimeType of ['application/octet-stream', '', undefined]) {
      const result = validateUpload('cover', candidate(JPEG_HEAD, { declaredMimeType, fileName: 'photo.bin' }));
      expect(result.ok).toBe(true);
    }
  });

  it('tells a renamed file apart from an unsupported one, because the fixes differ', () => {
    // Named like an image but is not one → "it may have been renamed or damaged".
    const renamed = validateUpload('cover', candidate(EXE_HEAD, { fileName: 'photo.jpg', declaredMimeType: 'image/jpeg' }));
    expect(renamed.ok).toBe(false);
    if (!renamed.ok) expect(renamed.message).toMatch(/renamed|damaged/i);

    // Honestly labelled as something we do not take → say what we do take.
    const unsupported = validateUpload(
      'cover',
      candidate(GIF_HEAD, { fileName: 'animation.gif', declaredMimeType: 'image/gif' })
    );
    expect(unsupported.ok).toBe(false);
    if (!unsupported.ok) expect(unsupported.message).toMatch(/JPG, PNG or WebP/i);
  });
});

describe('the format must match the field it was uploaded to', () => {
  it.each<UploadKind>(['cover', 'gallery'])('rejects a PDF in the %s field', (kind) => {
    const result = validateUpload(kind, candidate(PDF_HEAD, { fileName: 'brochure.pdf' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('WRONG_FORMAT_FOR_KIND');
      // Points at the field that WOULD accept it, rather than only refusing.
      expect(result.message).toMatch(/brochure field/i);
    }
  });

  it('rejects an image in the brochure field', () => {
    const result = validateUpload('brochure', candidate(PNG_HEAD, { fileName: 'scan.png' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('WRONG_FORMAT_FOR_KIND');
      expect(result.message).toMatch(/cover or gallery/i);
    }
  });

  it.each<[UploadKind, number[]]>([
    ['cover', JPEG_HEAD],
    ['cover', PNG_HEAD],
    ['cover', WEBP_HEAD],
    ['gallery', JPEG_HEAD],
    ['brochure', PDF_HEAD],
  ])('accepts the right format in the %s field', (kind, head) => {
    expect(validateUpload(kind, candidate(head)).ok).toBe(true);
  });
});

describe('size limits are enforced on the real byte count', () => {
  it('accepts an image exactly at the 10 MB limit', () => {
    // The boundary in the accepting direction — an off-by-one here silently
    // rejects a file the UI has just told the admin is fine.
    expect(validateUpload('cover', candidate(JPEG_HEAD, { byteLength: MAX_IMAGE_BYTES })).ok).toBe(true);
  });

  it('rejects an image one byte over the limit, and says how big it was', () => {
    const result = validateUpload('cover', candidate(JPEG_HEAD, { byteLength: MAX_IMAGE_BYTES + 1 }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('TOO_LARGE');
      expect(result.message).toContain('10 MB');
    }
  });

  it('gives the brochure its own, larger limit', () => {
    // 15 MB: over the image limit, under the brochure one. One shared limit would
    // have to be wrong for one of the two.
    const fifteenMb = 15 * 1024 * 1024;
    expect(validateUpload('brochure', candidate(PDF_HEAD, { byteLength: fifteenMb })).ok).toBe(true);
    expect(validateUpload('cover', candidate(JPEG_HEAD, { byteLength: fifteenMb })).ok).toBe(false);

    expect(validateUpload('brochure', candidate(PDF_HEAD, { byteLength: MAX_BROCHURE_BYTES })).ok).toBe(true);
    expect(validateUpload('brochure', candidate(PDF_HEAD, { byteLength: MAX_BROCHURE_BYTES + 1 })).ok).toBe(false);
  });

  it('reports size before format, because the two need different fixes', () => {
    // A 40 MB HEIC is both too large and the wrong format. Telling the admin to
    // convert it first would waste the round trip it would still be refused on.
    const result = validateUpload('cover', candidate(GIF_HEAD, { byteLength: MAX_IMAGE_BYTES * 4 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('TOO_LARGE');
  });

  it('rejects an empty file', () => {
    const result = validateUpload('cover', candidate(JPEG_HEAD, { byteLength: 0 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('EMPTY_FILE');
  });

  it('exposes the limit per kind, so the UI cannot state a different one', () => {
    expect(maxBytesFor('cover')).toBe(MAX_IMAGE_BYTES);
    expect(maxBytesFor('gallery')).toBe(MAX_IMAGE_BYTES);
    expect(maxBytesFor('brochure')).toBe(MAX_BROCHURE_BYTES);
  });
});

describe('supporting helpers', () => {
  it('reads at least 12 bytes, the length a WebP check needs', () => {
    expect(MAGIC_BYTE_PREFIX_LENGTH).toBeGreaterThanOrEqual(12);
  });

  it('accepts only the three known upload kinds', () => {
    expect(isUploadKind('cover')).toBe(true);
    expect(isUploadKind('gallery')).toBe(true);
    expect(isUploadKind('brochure')).toBe(true);
    for (const value of ['avatar', '', null, undefined, 42, '__proto__']) {
      expect(isUploadKind(value)).toBe(false);
    }
  });

  it('formats sizes the way the messages quote them', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(MAX_IMAGE_BYTES)).toBe('10 MB');
    expect(formatBytes(MAX_BROCHURE_BYTES)).toBe('20 MB');
    expect(formatBytes(Math.round(2.4 * 1024 * 1024))).toBe('2.4 MB');
  });
});

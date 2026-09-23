/**
 * @jest-environment node
 */

/**
 * `POST /api/admin/uploads` — the authenticated half of the upload path.
 *
 * ## What is mocked, and what deliberately is not
 *
 * MOCKED: the session (so each test states its own auth state) and the Cloudinary
 * SDK boundary (so no test uploads to a real account, spends money, or needs
 * credentials to run in CI).
 *
 * NOT MOCKED: `validateUpload`. The route runs the genuine validator over genuine
 * bytes, because the defect worth catching here is a route that forgets to call
 * it — and a mocked validator would return whatever this file's author believed
 * the rules were, so the test would pass with the check removed entirely. That is
 * the same reasoning `content-routes.test.ts` gives for driving the real
 * `isPubliclyListable()` gate.
 */

const mockGetAdminSession = jest.fn();
const mockUploadAsset = jest.fn();
const mockIsCloudinaryConfigured = jest.fn();

jest.mock('@/server/auth/session', () => ({
  getAdminSession: () => mockGetAdminSession(),
}));

jest.mock('@/server/uploads/cloudinary', () => ({
  isCloudinaryConfigured: () => mockIsCloudinaryConfigured(),
  uploadAsset: (request: unknown) => mockUploadAsset(request),
  CLOUDINARY_NOT_CONFIGURED: 'No Cloudinary account is configured.',
}));

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { POST } from '../route';
import { MAX_IMAGE_BYTES } from '@/server/uploads/file-validation';

const JPEG_MAGIC = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01];
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25, 0xe2, 0xe3];
const SVG_BYTES = Array.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>', (c) => c.charCodeAt(0));

function fileOf(magic: number[], { sizeBytes = 2048, name = 'photo.jpg', type = 'image/jpeg' } = {}): File {
  const bytes = new Uint8Array(sizeBytes);
  bytes.set(magic.slice(0, Math.min(magic.length, sizeBytes)));
  return new File([bytes], name, { type });
}

const ROUTE_URL = 'https://gty.example/api/admin/uploads';
const OWN_HOST = 'gty.example';

/**
 * Builds a request the way a BROWSER would, which `new Request(url, { body:
 * formData })` on its own does not.
 *
 * Two headers had to be added here when the route started enforcing them, and
 * both are genuinely present on a real upload:
 *
 *  - **`content-length`.** undici serialises a `FormData` body as a stream and
 *    sets no length; a browser computes the multipart body's size and sends it.
 *    So the probe request below is drained to a buffer first purely to measure
 *    it. Without this every test would now get a 411 — which is the route being
 *    right and the harness being unrepresentative.
 *  - **`host`.** Needed for the `Origin` comparison to have anything to compare
 *    against, and every HTTP/1.1 request carries it.
 *
 * `headers` is spread LAST so a test can override either, which is how the
 * refusal cases below are written.
 */
async function requestWith(body: FormData, headers: Record<string, string> = {}): Promise<Request> {
  const probe = new Request(ROUTE_URL, { method: 'POST', body });
  const bytes = new Uint8Array(await probe.arrayBuffer());

  return new Request(ROUTE_URL, {
    method: 'POST',
    body: new Blob([bytes]),
    headers: {
      'content-type': probe.headers.get('content-type') ?? '',
      'content-length': String(bytes.byteLength),
      host: OWN_HOST,
      ...headers,
    },
  });
}

function uploadForm(file: File, kind = 'cover', tourSlug?: string): FormData {
  const body = new FormData();
  body.append('kind', kind);
  body.append('file', file);
  if (tourSlug) body.append('tourSlug', tourSlug);
  return body;
}

const SIGNED_IN = { userId: 'admin-1', email: 'owner@example.com' };

const CLOUDINARY_RESULT = {
  url: 'https://res.cloudinary.com/demo/image/upload/v1/gty/tours/spiti/cover_new123.jpg',
  publicId: 'gty/tours/spiti/cover_new123',
  bytes: 2048,
  width: 1600,
  height: 1000,
  format: 'jpg',
  resourceType: 'image',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAdminSession.mockResolvedValue(SIGNED_IN);
  mockIsCloudinaryConfigured.mockReturnValue(true);
  mockUploadAsset.mockResolvedValue(CLOUDINARY_RESULT);
});

describe('the route is closed to anyone without an admin session', () => {
  it('answers 401 and uploads NOTHING when there is no session', async () => {
    mockGetAdminSession.mockResolvedValue(null);

    const response = await POST(await requestWith(uploadForm(fileOf(JPEG_MAGIC))));

    expect(response.status).toBe(401);
    /**
     * The assertion that matters. A 401 that had already spent a Cloudinary
     * upload would be an auth check in name only — the money and the stored
     * asset are the real effect, and the status code is just a report about it.
     */
    expect(mockUploadAsset).not.toHaveBeenCalled();
  });

  it('answers with JSON, not a redirect to the login page', async () => {
    // `requireAdminSession()` redirects, which is right for a navigation and
    // wrong here: a 307 to an HTML form arrives at a `fetch()` expecting JSON and
    // surfaces to the admin as a parse error rather than "you were signed out".
    mockGetAdminSession.mockResolvedValue(null);

    const response = await POST(await requestWith(uploadForm(fileOf(JPEG_MAGIC))));

    expect(response.status).not.toBe(307);
    expect(response.headers.get('content-type')).toMatch(/application\/json/);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/session/i);
  });

  it('checks the session BEFORE reading the body', async () => {
    // So an unauthenticated request cannot make the server buffer a large upload
    // as a side effect of being rejected.
    mockGetAdminSession.mockResolvedValue(null);

    const body = uploadForm(fileOf(JPEG_MAGIC));
    const request = await requestWith(body);

    await POST(request);

    // An unread body is the evidence: `formData()` would have consumed it.
    expect(request.bodyUsed).toBe(false);
  });

  it('refuses a cross-site POST even with a valid session', async () => {
    const response = await POST(await requestWith(uploadForm(fileOf(JPEG_MAGIC)), { 'sec-fetch-site': 'cross-site' }));

    expect(response.status).toBe(403);
    expect(mockUploadAsset).not.toHaveBeenCalled();
  });

  it('allows a same-origin POST', async () => {
    const response = await POST(await requestWith(uploadForm(fileOf(JPEG_MAGIC)), { 'sec-fetch-site': 'same-origin' }));
    expect(response.status).toBe(200);
  });
});

describe('server-side validation runs on the bytes, not on what the client claims', () => {
  it('rejects an SVG that declares image/jpeg and is named .jpg', async () => {
    /**
     * The whole point of the route. `accept="image/jpeg"` on the input is a
     * file-picker filter, and this request never touched a file picker — the
     * declared type and the extension both say JPEG, and the contents say
     * otherwise. An SVG accepted as an image is a stored-XSS vector the moment
     * a browser is asked to render it from a trusted origin.
     */
    const svg = new File([new Uint8Array(SVG_BYTES)], 'holiday.jpg', { type: 'image/jpeg' });

    const response = await POST(await requestWith(uploadForm(svg)));

    expect(response.status).toBe(400);
    expect(mockUploadAsset).not.toHaveBeenCalled();
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/renamed|damaged/i);
  });

  it('rejects an oversized image with 413, before uploading it', async () => {
    const huge = fileOf(JPEG_MAGIC, { sizeBytes: MAX_IMAGE_BYTES + 1 });

    const response = await POST(await requestWith(uploadForm(huge)));

    expect(response.status).toBe(413);
    expect(mockUploadAsset).not.toHaveBeenCalled();
  });

  it('rejects a PDF sent to the cover field', async () => {
    const pdf = fileOf(PDF_MAGIC, { name: 'brochure.pdf', type: 'application/pdf' });

    const response = await POST(await requestWith(uploadForm(pdf, 'cover')));

    expect(response.status).toBe(400);
    expect(mockUploadAsset).not.toHaveBeenCalled();
  });

  it('rejects an image sent to the brochure field', async () => {
    const response = await POST(await requestWith(uploadForm(fileOf(JPEG_MAGIC), 'brochure')));

    expect(response.status).toBe(400);
    expect(mockUploadAsset).not.toHaveBeenCalled();
  });

  it('rejects an unknown upload kind', async () => {
    const response = await POST(await requestWith(uploadForm(fileOf(JPEG_MAGIC), 'avatar')));

    expect(response.status).toBe(400);
    expect(mockUploadAsset).not.toHaveBeenCalled();
  });

  it('rejects a request with no file at all', async () => {
    const body = new FormData();
    body.append('kind', 'cover');

    const response = await POST(await requestWith(body));

    expect(response.status).toBe(400);
    expect(mockUploadAsset).not.toHaveBeenCalled();
  });

  it('rejects an empty file', async () => {
    const empty = new File([new Uint8Array(0)], 'empty.jpg', { type: 'image/jpeg' });

    const response = await POST(await requestWith(uploadForm(empty)));

    expect(response.status).toBe(400);
    expect(mockUploadAsset).not.toHaveBeenCalled();
  });
});

describe('an accepted upload', () => {
  it('accepts a real JPEG and returns the stored asset', async () => {
    const response = await POST(await requestWith(uploadForm(fileOf(JPEG_MAGIC), 'cover', 'spiti-valley')));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { url: string; publicId: string; kind: string } };
    expect(body.data.url).toBe(CLOUDINARY_RESULT.url);
    expect(body.data.publicId).toBe(CLOUDINARY_RESULT.publicId);
    // Echoed so the client can discard a response that arrived for another field.
    expect(body.data.kind).toBe('cover');
  });

  it('accepts a real PDF in the brochure field', async () => {
    mockUploadAsset.mockResolvedValue({
      ...CLOUDINARY_RESULT,
      url: 'https://res.cloudinary.com/demo/raw/upload/v1/gty/tours/spiti/brochure/spiti_x1.pdf',
      resourceType: 'raw',
      format: 'pdf',
      width: undefined,
      height: undefined,
    });

    const pdf = fileOf(PDF_MAGIC, { name: 'spiti.pdf', type: 'application/pdf' });
    const response = await POST(await requestWith(uploadForm(pdf, 'brochure')));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { width: number | null; fileName: string } };
    // A raw PDF has no dimensions, and null says so rather than 0 implying a
    // zero-pixel image.
    expect(body.data.width).toBeNull();
    expect(body.data.fileName).toBe('spiti.pdf');
  });

  it('passes the tour slug through so assets are filed per tour', async () => {
    await POST(await requestWith(uploadForm(fileOf(JPEG_MAGIC), 'cover', 'spiti-valley')));

    expect(mockUploadAsset).toHaveBeenCalledWith(expect.objectContaining({ tourSlug: 'spiti-valley', kind: 'cover' }));
  });

  it('handles a tour that has no slug yet, for the create form', async () => {
    await POST(await requestWith(uploadForm(fileOf(JPEG_MAGIC), 'cover')));

    expect(mockUploadAsset).toHaveBeenCalledWith(expect.objectContaining({ tourSlug: null }));
  });

  it('returns 500 with no internal detail when Cloudinary throws', async () => {
    mockUploadAsset.mockRejectedValue(new Error('Cloudinary: Invalid api_key abc123'));

    const response = await POST(await requestWith(uploadForm(fileOf(JPEG_MAGIC))));

    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: string };
    // The credential must not travel back to the browser in an error message.
    expect(body.error).not.toMatch(/api_key|abc123/);
  });
});

describe('an unconfigured environment says so, rather than failing obscurely', () => {
  it('answers 503 when no Cloudinary account is configured', async () => {
    mockIsCloudinaryConfigured.mockReturnValue(false);

    const response = await POST(await requestWith(uploadForm(fileOf(JPEG_MAGIC))));

    // 503 and not 500: nothing is broken and nothing the admin did is wrong.
    // Same distinction `/api/brochures/[slug]` draws for a missing database.
    expect(response.status).toBe(503);
    expect(mockUploadAsset).not.toHaveBeenCalled();
  });

  it('still requires a session before reporting the misconfiguration', async () => {
    // Otherwise the route is an unauthenticated probe for how this deployment is
    // configured.
    mockGetAdminSession.mockResolvedValue(null);
    mockIsCloudinaryConfigured.mockReturnValue(false);

    const response = await POST(await requestWith(uploadForm(fileOf(JPEG_MAGIC))));

    expect(response.status).toBe(401);
  });
});

/**
 * M3 — WHICH ORIGINS MAY UPLOAD.
 *
 * The old check refused `sec-fetch-site: cross-site` and nothing else, under a
 * comment stating that `same-site` "covers a subdomain" and was therefore
 * acceptable. `same-site` is a DIFFERENT ORIGIN sharing a registrable domain,
 * and `SameSite=Lax` — the cookie defence this was supposed to be independent
 * of — treats a sibling subdomain as same-site too. So both lines had the same
 * blind spot, and any host ever pointed at a sibling of the admin's domain
 * could POST here carrying the admin's session.
 */
describe('only this origin may upload', () => {
  const ALLOWED: [string, Record<string, string>][] = [
    ['the admin UI’s own XHR', { 'sec-fetch-site': 'same-origin' }],
    ['a non-browser client that sends no Sec-Fetch-Site', {}],
    [
      'a same-origin XHR that also sends a matching Origin',
      { 'sec-fetch-site': 'same-origin', origin: `https://${OWN_HOST}` },
    ],
    [
      'a request arriving through a proxy, matched on x-forwarded-host',
      {
        'sec-fetch-site': 'same-origin',
        origin: 'https://www.gurujitravelyatra.com',
        host: 'internal-app.railway.internal',
        'x-forwarded-host': 'www.gurujitravelyatra.com',
      },
    ],
  ];

  const REFUSED: [string, Record<string, string>][] = [
    ['a sibling subdomain — THE FINDING', { 'sec-fetch-site': 'same-site' }],
    ['a cross-site POST', { 'sec-fetch-site': 'cross-site' }],
    ['a top-level navigation', { 'sec-fetch-site': 'none' }],
    ['an unrecognised Sec-Fetch-Site value', { 'sec-fetch-site': 'nonsense' }],
    ['a foreign Origin with no Sec-Fetch-Site at all', { origin: 'https://evil.example' }],
    ['a sibling subdomain named in Origin', { origin: 'https://staging.gty.example' }],
    ['a sandboxed iframe', { origin: 'null' }],
    ['an unparseable Origin', { origin: 'not a url' }],
    [
      'a foreign Origin even when Sec-Fetch-Site claims same-origin',
      { 'sec-fetch-site': 'same-origin', origin: 'https://evil.example' },
    ],
  ];

  it('covers both directions', () => {
    // Guard the guard. A table that lost its rows takes every `it.each` with it
    // and the suite still reports green.
    expect(ALLOWED.length).toBeGreaterThanOrEqual(4);
    expect(REFUSED.length).toBeGreaterThanOrEqual(9);
  });

  it.each(ALLOWED)('allows %s', async (_label, headers) => {
    const response = await POST(await requestWith(uploadForm(fileOf(JPEG_MAGIC)), headers));
    expect(response.status).toBe(200);
  });

  it.each(REFUSED)('refuses %s', async (_label, headers) => {
    const request = await requestWith(uploadForm(fileOf(JPEG_MAGIC)), headers);
    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(mockUploadAsset).not.toHaveBeenCalled();
    // And nothing was buffered on the way to saying no.
    expect(request.bodyUsed).toBe(false);
  });
});

/**
 * M2 — THE SIZE GUARD THAT ANY CLIENT COULD SWITCH OFF.
 *
 *   const declaredLength = Number(request.headers.get('content-length') ?? '0');
 *   if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES)
 *
 * `Number('abc')` is `NaN` and `Number.isFinite(NaN)` is `false`, so sending
 * `Content-Length: abc` skipped the check entirely and the whole body was
 * buffered. The `?? '0'` did the same for an absent header, more quietly — it
 * invented a zero and reported the request as comfortably under the cap.
 */
describe('the declared body size is enforced, not merely consulted', () => {
  /**
   * The route no longer calls `request.formData()` at all — it reads the body
   * under a cap and parses the resulting buffer. So the strongest available
   * evidence that a refusal happened BEFORE any buffering is `bodyUsed`, which
   * is false only if the stream was never touched. The `formData` spy is kept
   * beside it because it is what a reader of this test expects to see, and
   * because it would catch a future edit that reverted to the old call.
   */
  async function expectRefusedBeforeReadingBody(headers: Record<string, string>, status: number) {
    const request = await requestWith(uploadForm(fileOf(JPEG_MAGIC)), headers);
    const formDataSpy = jest.spyOn(request, 'formData');

    const response = await POST(request);

    expect(response.status).toBe(status);
    expect(formDataSpy).not.toHaveBeenCalled();
    expect(request.bodyUsed).toBe(false);
    expect(mockUploadAsset).not.toHaveBeenCalled();
  }

  it('refuses an UNPARSEABLE Content-Length — the finding', async () => {
    await expectRefusedBeforeReadingBody({ 'content-length': 'abc' }, 400);
  });

  it.each([
    ['a negative length', '-1'],
    ['scientific notation', '1e5'],
    ['hex', '0x10'],
    ['a decimal', '12.5'],
    ['an empty value', ''],
  ])('refuses %s', async (_label, value) => {
    /**
     * `Number()` accepts every one of these, which is why the check is a digit
     * test on the TOKEN rather than a parse of it: where `Number` and the
     * sender disagree about what the header says, the guard is measuring
     * something nobody sent.
     *
     * NOT in this list, and worth saying why: a padded ` 12 `. It looks like
     * the same class of bug and cannot reach the handler — the HTTP layer
     * strips optional whitespace from header values before any handler sees
     * them, so it arrives as `12`. Asserting on it would be testing undici, and
     * it would have failed for the wrong reason.
     */
    await expectRefusedBeforeReadingBody({ 'content-length': value }, 400);
  });

  it('refuses a request that declares no size at all', async () => {
    // 411 Length Required — the status that exists for exactly this. A chunked
    // upload has no length and this route buffers, so it cannot be accepted.
    const request = new Request(ROUTE_URL, {
      method: 'POST',
      body: uploadForm(fileOf(JPEG_MAGIC)),
      headers: { host: OWN_HOST },
    });

    const response = await POST(request);

    expect(response.status).toBe(411);
    expect(request.bodyUsed).toBe(false);
  });

  it('refuses an oversized declaration with 413', async () => {
    await expectRefusedBeforeReadingBody({ 'content-length': String(10 * 1024 * 1024 * 1024) }, 413);
  });

  it('enforces the cap on the BYTES when Content-Length lies', async () => {
    /**
     * The half a header check cannot do. `Content-Length` is a claim, and a
     * client that declares 2 kB is free to send anything —
     * `request.formData()` would have buffered all of it. The route now reads
     * the stream itself and abandons it past the cap, so the limit applies to
     * what arrives rather than to what was promised.
     */
    /**
     * The bulk is a TEXT field beside a small, perfectly valid JPEG. The first
     * version of this test used a 40 MB image, and was vacuous: with the stream
     * cap deleted it still got a 413 — from the per-file size check further
     * down, which a 40 MB image also fails. Padding outside the file means the
     * stream cap is the ONLY thing that can refuse this request; without it the
     * route buffers 40 MB and uploads the JPEG (verified by mutation).
     */
    const padded = uploadForm(fileOf(JPEG_MAGIC));
    padded.append('padding', 'x'.repeat(40 * 1024 * 1024));
    const honest = await requestWith(padded);

    // The body really is over the cap, and the declaration below really is
    // under it — otherwise this is just re-checking the header branch above.
    expect(Number(honest.headers.get('content-length'))).toBeGreaterThan(30 * 1024 * 1024);

    const lying = new Request(ROUTE_URL, {
      method: 'POST',
      body: new Blob([new Uint8Array(await honest.arrayBuffer())]),
      headers: {
        'content-type': honest.headers.get('content-type') ?? '',
        'content-length': '2048',
        host: OWN_HOST,
      },
    });

    const response = await POST(lying);

    expect(response.status).toBe(413);
    expect(mockUploadAsset).not.toHaveBeenCalled();
  });
});

/**
 * L1 — THE TOUR SLUG REACHED A PATH BUILDER UNVALIDATED.
 *
 * It becomes a segment of the Cloudinary folder (`gty/tours/<slug>/<kind>`) and
 * arrives from a form field on a hand-craftable request. The old check was
 * `length > 0`.
 */
describe('the tour slug is validated before it becomes a folder name', () => {
  it.each([
    ['a traversal attempt', '../../x'],
    ['an absolute path', '/etc/passwd'],
    ['a nested path', 'spiti/../../../secrets'],
    /**
     * This one FOUND A REAL GAP rather than confirming a fix. `SLUG_PATTERN`
     * constrains shape and not size, so 5,000 `a`s satisfied it and the upload
     * was accepted. The cap was added INSIDE the shared `SLUG_PATTERN` in
     * response — so a slug nobody's browser can request is also refused at the
     * form, and no consumer of the pattern can forget the length half.
     */
    ['an oversized string', 'a'.repeat(5000)],
    ['a slug one character over the cap', 'a'.repeat(101)],
    ['a slug with a space', 'spiti valley'],
    ['uppercase', 'Spiti-Valley'],
    ['a trailing hyphen', 'spiti-'],
    ['a null byte', 'spiti\0valley'],
  ])('refuses %s and uploads nothing', async (_label, slug) => {
    const response = await POST(await requestWith(uploadForm(fileOf(JPEG_MAGIC), 'cover', slug)));

    expect(response.status).toBe(400);
    expect(mockUploadAsset).not.toHaveBeenCalled();
  });

  it('still accepts a real slug, and files the asset under it', async () => {
    // Guard the guard: the refusals above pass just as well if EVERY slug is
    // refused, which would break uploads outright.
    const response = await POST(
      await requestWith(uploadForm(fileOf(JPEG_MAGIC), 'cover', 'spiti-valley-circuit'))
    );

    expect(response.status).toBe(200);
    expect(mockUploadAsset).toHaveBeenCalledWith(
      expect.objectContaining({ tourSlug: 'spiti-valley-circuit' })
    );
  });

  it('uses THE slug rule, not a second looser one living in the route', () => {
    // The folder a draft's assets land in must not be able to disagree with the
    // slug that draft will be saved under, so the route imports the schema's
    // constant rather than restating the pattern.
    const source = readFileSync(join(__dirname, '..', 'route.ts'), 'utf8');

    expect(source.length).toBeGreaterThan(500);
    expect(source).toContain("import { SLUG_PATTERN } from '@/server/admin/tours/tour-form-schema'");
    expect(source).toContain('SLUG_PATTERN.test(tourSlugField)');
  });
});

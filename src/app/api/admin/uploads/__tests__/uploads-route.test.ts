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

function requestWith(body: FormData, headers: Record<string, string> = {}): Request {
  return new Request('https://gty.example/api/admin/uploads', { method: 'POST', body, headers });
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

    const response = await POST(requestWith(uploadForm(fileOf(JPEG_MAGIC))));

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

    const response = await POST(requestWith(uploadForm(fileOf(JPEG_MAGIC))));

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
    const request = requestWith(body);

    await POST(request);

    // An unread body is the evidence: `formData()` would have consumed it.
    expect(request.bodyUsed).toBe(false);
  });

  it('refuses a cross-site POST even with a valid session', async () => {
    const response = await POST(requestWith(uploadForm(fileOf(JPEG_MAGIC)), { 'sec-fetch-site': 'cross-site' }));

    expect(response.status).toBe(403);
    expect(mockUploadAsset).not.toHaveBeenCalled();
  });

  it('allows a same-origin POST', async () => {
    const response = await POST(requestWith(uploadForm(fileOf(JPEG_MAGIC)), { 'sec-fetch-site': 'same-origin' }));
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

    const response = await POST(requestWith(uploadForm(svg)));

    expect(response.status).toBe(400);
    expect(mockUploadAsset).not.toHaveBeenCalled();
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/renamed|damaged/i);
  });

  it('rejects an oversized image with 413, before uploading it', async () => {
    const huge = fileOf(JPEG_MAGIC, { sizeBytes: MAX_IMAGE_BYTES + 1 });

    const response = await POST(requestWith(uploadForm(huge)));

    expect(response.status).toBe(413);
    expect(mockUploadAsset).not.toHaveBeenCalled();
  });

  it('rejects a PDF sent to the cover field', async () => {
    const pdf = fileOf(PDF_MAGIC, { name: 'brochure.pdf', type: 'application/pdf' });

    const response = await POST(requestWith(uploadForm(pdf, 'cover')));

    expect(response.status).toBe(400);
    expect(mockUploadAsset).not.toHaveBeenCalled();
  });

  it('rejects an image sent to the brochure field', async () => {
    const response = await POST(requestWith(uploadForm(fileOf(JPEG_MAGIC), 'brochure')));

    expect(response.status).toBe(400);
    expect(mockUploadAsset).not.toHaveBeenCalled();
  });

  it('rejects an unknown upload kind', async () => {
    const response = await POST(requestWith(uploadForm(fileOf(JPEG_MAGIC), 'avatar')));

    expect(response.status).toBe(400);
    expect(mockUploadAsset).not.toHaveBeenCalled();
  });

  it('rejects a request with no file at all', async () => {
    const body = new FormData();
    body.append('kind', 'cover');

    const response = await POST(requestWith(body));

    expect(response.status).toBe(400);
    expect(mockUploadAsset).not.toHaveBeenCalled();
  });

  it('rejects an empty file', async () => {
    const empty = new File([new Uint8Array(0)], 'empty.jpg', { type: 'image/jpeg' });

    const response = await POST(requestWith(uploadForm(empty)));

    expect(response.status).toBe(400);
    expect(mockUploadAsset).not.toHaveBeenCalled();
  });
});

describe('an accepted upload', () => {
  it('accepts a real JPEG and returns the stored asset', async () => {
    const response = await POST(requestWith(uploadForm(fileOf(JPEG_MAGIC), 'cover', 'spiti-valley')));

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
    const response = await POST(requestWith(uploadForm(pdf, 'brochure')));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { width: number | null; fileName: string } };
    // A raw PDF has no dimensions, and null says so rather than 0 implying a
    // zero-pixel image.
    expect(body.data.width).toBeNull();
    expect(body.data.fileName).toBe('spiti.pdf');
  });

  it('passes the tour slug through so assets are filed per tour', async () => {
    await POST(requestWith(uploadForm(fileOf(JPEG_MAGIC), 'cover', 'spiti-valley')));

    expect(mockUploadAsset).toHaveBeenCalledWith(expect.objectContaining({ tourSlug: 'spiti-valley', kind: 'cover' }));
  });

  it('handles a tour that has no slug yet, for the create form', async () => {
    await POST(requestWith(uploadForm(fileOf(JPEG_MAGIC), 'cover')));

    expect(mockUploadAsset).toHaveBeenCalledWith(expect.objectContaining({ tourSlug: null }));
  });

  it('returns 500 with no internal detail when Cloudinary throws', async () => {
    mockUploadAsset.mockRejectedValue(new Error('Cloudinary: Invalid api_key abc123'));

    const response = await POST(requestWith(uploadForm(fileOf(JPEG_MAGIC))));

    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: string };
    // The credential must not travel back to the browser in an error message.
    expect(body.error).not.toMatch(/api_key|abc123/);
  });
});

describe('an unconfigured environment says so, rather than failing obscurely', () => {
  it('answers 503 when no Cloudinary account is configured', async () => {
    mockIsCloudinaryConfigured.mockReturnValue(false);

    const response = await POST(requestWith(uploadForm(fileOf(JPEG_MAGIC))));

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

    const response = await POST(requestWith(uploadForm(fileOf(JPEG_MAGIC))));

    expect(response.status).toBe(401);
  });
});

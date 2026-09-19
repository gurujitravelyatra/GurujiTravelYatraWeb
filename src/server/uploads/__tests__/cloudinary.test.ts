/**
 * @jest-environment node
 */

/**
 * REPLACEMENT SAFETY, Cloudinary half.
 *
 * The product spec's brochure rule — never destroy something a live page or a
 * lead still points at — generalises to every asset here, and the mechanism that
 * delivers it is three upload options rather than any code that runs at replace
 * time. That makes it exactly the kind of property that rots silently: someone
 * adds `overwrite: true` to "fix" a duplicate and nothing fails, no test goes
 * red, and the next replacement of a published tour's cover mutates the asset
 * the live site is serving mid-request.
 *
 * So these tests assert the options themselves. The Cloudinary SDK is mocked at
 * its own boundary: no test here uploads anything, needs credentials, or costs
 * money, and none of them can — which is also what lets the suite run in an
 * environment that has no Cloudinary account at all.
 */

const mockUploadStream = jest.fn();
const mockConfig = jest.fn();

jest.mock('cloudinary', () => ({
  v2: {
    config: (options: unknown) => mockConfig(options),
    uploader: {
      upload_stream: (options: unknown, callback: unknown) => mockUploadStream(options, callback),
    },
  },
}));

import { CLOUDINARY_NOT_CONFIGURED, isCloudinaryConfigured, uploadAsset } from '../cloudinary';

const CLOUDINARY_RESPONSE = {
  secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/gty/tours/spiti/cover/spiti_a7f3c1.jpg',
  public_id: 'gty/tours/spiti/cover/spiti_a7f3c1',
  bytes: 204_800,
  width: 1600,
  height: 1000,
  format: 'jpg',
  resource_type: 'image',
};

/** Captures the options and immediately completes the stream with a fixed response. */
function captureUpload(response: Record<string, unknown> = CLOUDINARY_RESPONSE) {
  let captured: Record<string, unknown> = {};

  mockUploadStream.mockImplementation((options, callback: (error: unknown, result: unknown) => void) => {
    captured = options as Record<string, unknown>;
    return {
      end: () => {
        // Async so the promise the caller is awaiting is already pending, as it
        // is against the real SDK.
        setImmediate(() => callback(null, response));
      },
    };
  });

  return () => captured;
}

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = {
    ...ORIGINAL_ENV,
    CLOUDINARY_CLOUD_NAME: 'test-cloud',
    CLOUDINARY_API_KEY: 'test-key',
    CLOUDINARY_API_SECRET: 'test-secret',
  };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

function imageRequest(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'cover' as const,
    format: 'jpeg' as const,
    bytes: Buffer.from([0xff, 0xd8, 0xff]),
    fileName: 'spiti-cover.jpg',
    tourSlug: 'spiti-valley',
    ...overrides,
  };
}

describe('replacing an asset never overwrites the one that is live', () => {
  it('NEVER sends overwrite: true', async () => {
    const options = captureUpload();
    await uploadAsset(imageRequest());

    // The single most important assertion in this file. `overwrite: true` plus a
    // stable public_id is the other obvious way to write an upload, and it
    // mutates the asset a published tour is currently serving.
    expect(options().overwrite).toBe(false);
  });

  it('NEVER pins an explicit public_id, so Cloudinary mints a new one each time', async () => {
    const options = captureUpload();
    await uploadAsset(imageRequest());

    // With no `public_id`, a replacement is an ADDITION: the old asset keeps its
    // id and keeps resolving. This is what makes the swap atomic from a
    // visitor's point of view — the URL changes in one database statement, and
    // both URLs work either side of it.
    expect(options().public_id).toBeUndefined();
    expect(options().unique_filename).toBe(true);
  });

  it('uploads the same tour twice without either call naming the other', async () => {
    // The replacement scenario end to end, at this layer: two uploads for one
    // tour produce two independent requests, neither of which references or
    // invalidates the other's asset.
    const options = captureUpload();

    await uploadAsset(imageRequest({ fileName: 'original.jpg' }));
    const first = { ...options() };

    await uploadAsset(imageRequest({ fileName: 'replacement.jpg' }));
    const second = { ...options() };

    expect(first.filename_override).toBe('original.jpg');
    expect(second.filename_override).toBe('replacement.jpg');
    for (const call of [first, second]) {
      expect(call.overwrite).toBe(false);
      expect(call.public_id).toBeUndefined();
      expect(call.invalidate).toBeUndefined();
    }
  });

  it('destroys nothing — this module has no delete path at all', async () => {
    // Stated as a test because it is a deliberate trade, not an omission:
    // orphaned assets cost storage, a deleted-too-early asset costs a broken
    // live page. Reclaiming orphans is a follow-up sweep, not something to bolt
    // onto the request trying to make the swap safe.
    const cloudinary = jest.requireMock('cloudinary') as { v2: { uploader: Record<string, unknown> } };
    expect(cloudinary.v2.uploader.destroy).toBeUndefined();

    captureUpload();
    await expect(uploadAsset(imageRequest())).resolves.toBeDefined();
  });
});

describe('the upload request itself', () => {
  it('files assets under the tour and the field they belong to', async () => {
    const options = captureUpload();
    await uploadAsset(imageRequest({ kind: 'gallery', tourSlug: 'leh-ladakh' }));

    expect(options().folder).toBe('gty/tours/leh-ladakh/gallery');
  });

  it('files a not-yet-saved tour somewhere identifiable rather than at the root', async () => {
    const options = captureUpload();
    await uploadAsset(imageRequest({ tourSlug: null }));

    expect(options().folder).toBe('gty/tours/_unsaved/cover');
  });

  it('restricts the formats Cloudinary itself will accept, as a second check', async () => {
    const options = captureUpload();
    await uploadAsset(imageRequest());

    // Independent of our magic-byte sniff, on the far side of the network: even
    // if something got past the sniffer it still cannot land an SVG.
    expect(options().allowed_formats).toEqual(['jpg', 'jpeg', 'png', 'webp']);
  });

  it('sends a PDF as a RAW resource, not an image', async () => {
    const options = captureUpload({
      ...CLOUDINARY_RESPONSE,
      resource_type: 'raw',
      format: 'pdf',
      width: undefined,
      height: undefined,
    });

    await uploadAsset(imageRequest({ kind: 'brochure', format: 'pdf', fileName: 'spiti.pdf' }));

    /**
     * Cloudinary CAN hold a PDF as an `image` and rasterise a thumbnail from it,
     * but delivery of image-type PDFs is disabled by default on a Cloudinary
     * account — that choice yields an upload that succeeds and a download link
     * that 401s for every visitor, which nothing in this codebase would notice.
     * `raw` is not subject to that setting.
     */
    expect(options().resource_type).toBe('raw');
    expect(options().allowed_formats).toEqual(['pdf']);
  });

  it('returns the secure (https) URL, never the plain-http one', async () => {
    captureUpload();
    const asset = await uploadAsset(imageRequest());

    expect(asset.url).toBe(CLOUDINARY_RESPONSE.secure_url);
    expect(asset.url.startsWith('https://')).toBe(true);
    expect(asset.publicId).toBe(CLOUDINARY_RESPONSE.public_id);
  });

  it('rejects when Cloudinary reports an error, so no URL is ever invented', async () => {
    mockUploadStream.mockImplementation((_options, callback: (error: unknown, result: unknown) => void) => ({
      end: () => setImmediate(() => callback({ message: 'File size too large' }, undefined)),
    }));

    await expect(uploadAsset(imageRequest())).rejects.toThrow(/File size too large/);
  });

  it('rejects when Cloudinary returns neither an error nor a response', async () => {
    // The case that would otherwise resolve with `undefined.secure_url` and
    // write `undefined` into the tour's cover column.
    mockUploadStream.mockImplementation((_options, callback: (error: unknown, result: unknown) => void) => ({
      end: () => setImmediate(() => callback(null, undefined)),
    }));

    await expect(uploadAsset(imageRequest())).rejects.toThrow(/no response/i);
  });
});

describe('configuration is read per call and never throws at import', () => {
  it('reports configured only when all three variables are present', () => {
    expect(isCloudinaryConfigured()).toBe(true);

    for (const missing of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
      const saved = process.env[missing];
      delete process.env[missing];
      // Two of three is a half-finished deployment. Treating it as configured
      // would surface as an opaque 401 from Cloudinary at the moment an admin
      // uploads, rather than as a clear "not configured".
      expect(isCloudinaryConfigured()).toBe(false);
      process.env[missing] = saved;
    }
  });

  it('throws only when an upload is ATTEMPTED without configuration', async () => {
    // Never at module load: `next build` runs with NODE_ENV=production and
    // evaluates every page module, so a module-level throw on missing config
    // breaks the BUILD rather than the request.
    delete process.env.CLOUDINARY_API_SECRET;

    await expect(uploadAsset(imageRequest())).rejects.toThrow(CLOUDINARY_NOT_CONFIGURED);
    expect(mockUploadStream).not.toHaveBeenCalled();
  });

  it('does not put the api secret anywhere but the SDK config call', async () => {
    captureUpload();
    const asset = await uploadAsset(imageRequest());

    expect(mockConfig).toHaveBeenCalledWith(expect.objectContaining({ api_secret: 'test-secret' }));
    // The returned asset is what travels back to the browser.
    expect(JSON.stringify(asset)).not.toContain('test-secret');
  });
});

/**
 * @jest-environment node
 */

import { isSafeMediaUrl, safeMediaUrl } from '../cloudinary-url';
import { CLOUDINARY_URL_PREFIX } from '@/server/admin/tours/tour-form-schema';

/**
 * RENDER-TIME MEDIA URL REFUSAL — L5 of the 2026-09-19 review.
 *
 * The write path already pins media URLs to Cloudinary (`cloudinaryUrl` in the
 * tour schema). This is the READ-side twin: `PhotoPlaceholder` and the detail
 * page's gallery links both turn a stored column into something a browser
 * fetches or follows, and "no validator would have allowed this value" is not
 * the same claim as "this value is not in the column". A direct SQL edit, a
 * restore of an older backup, or any future import script bypasses every
 * validator that has ever existed.
 *
 * The behavioural proof is in `stored-xss-render.test.tsx`, which plants
 * hostile URLs in a rendered page. This file pins the predicate itself, and the
 * one thing that file cannot check: that the two copies of the prefix agree.
 */

describe('isSafeMediaUrl', () => {
  it.each([
    'https://res.cloudinary.com/demo/image/upload/v1/cover.jpg',
    'https://res.cloudinary.com/gty/raw/upload/v1/brochure.pdf',
    'https://res.cloudinary.com/a/image/upload/w_1200,c_limit,q_auto,f_auto/v1/x.webp',
  ])('accepts a real delivery URL: %s', (url) => {
    expect(isSafeMediaUrl(url)).toBe(true);
    expect(safeMediaUrl(url)).toBe(url);
  });

  it.each([
    ['a javascript: URL', 'javascript:alert(1)'],
    ['an obfuscated javascript: URL', ' java\tscript:alert(1)'],
    ['an uppercase scheme', 'JAVASCRIPT:alert(1)'],
    ['an HTML data: URL', 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='],
    ['a vbscript: URL', 'vbscript:msgbox(1)'],
    ['plain http, not https', 'http://res.cloudinary.com/demo/image/upload/v1/x.jpg'],
    ['a lookalike host', 'https://res.cloudinary.com.evil.example/image/upload/v1/x.jpg'],
    ['a userinfo trick', 'https://res.cloudinary.com@evil.example/x.jpg'],
    ['another host entirely', 'https://evil.example/image/upload/v1/x.jpg'],
    ['a protocol-relative URL', '//res.cloudinary.com/demo/image/upload/v1/x.jpg'],
    ['a same-origin path', '/uploads/x.jpg'],
    ['an empty string', ''],
  ])('refuses %s', (_label, url) => {
    expect(isSafeMediaUrl(url)).toBe(false);
    expect(safeMediaUrl(url)).toBeUndefined();
  });

  it('refuses absent values without throwing', () => {
    // These reach it from optional columns (`coverImageUrl?: string`), so the
    // absent case is ordinary rather than exceptional.
    expect(isSafeMediaUrl(undefined)).toBe(false);
    expect(isSafeMediaUrl(null)).toBe(false);
    expect(safeMediaUrl(undefined)).toBeUndefined();
  });

  it('the trailing slash in the prefix is what stops the lookalike host', () => {
    // Worth stating as its own assertion, because the trailing slash looks like
    // punctuation and is the entire defence against
    // `res.cloudinary.com.evil.example`. Someone tidying it away would break
    // this and nothing else visible.
    expect(isSafeMediaUrl('https://res.cloudinary.com/x')).toBe(true);
    expect(isSafeMediaUrl('https://res.cloudinary.comx')).toBe(false);
  });
});

/**
 * CRM-migration decision 4 — the allowlist now also accepts an R2 host, read
 * from `NEXT_PUBLIC_MEDIA_HOST`, EXACTLY (no wildcard). `cloudinary-url.ts`
 * reads that env var once at module load, so each case here reloads the
 * module fresh via `jest.isolateModules` with the env var set (or deleted)
 * beforehand — the only way to exercise both the "configured" and "unset"
 * states in one file.
 */
describe('isSafeMediaUrl with NEXT_PUBLIC_MEDIA_HOST configured', () => {
  const FAKE_R2_HOST = 'https://media.example.r2.dev';
  const originalEnv = process.env.NEXT_PUBLIC_MEDIA_HOST;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.NEXT_PUBLIC_MEDIA_HOST;
    else process.env.NEXT_PUBLIC_MEDIA_HOST = originalEnv;
  });

  function freshModule(): typeof import('../cloudinary-url') {
    let mod!: typeof import('../cloudinary-url');
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      mod = require('../cloudinary-url');
    });
    return mod;
  }

  it('renders a real R2 URL once the host is configured', () => {
    process.env.NEXT_PUBLIC_MEDIA_HOST = FAKE_R2_HOST;
    const { isSafeMediaUrl, safeMediaUrl } = freshModule();

    const url = `${FAKE_R2_HOST}/tour-images/abc.jpg`;
    expect(isSafeMediaUrl(url)).toBe(true);
    expect(safeMediaUrl(url)).toBe(url);
  });

  it('still refuses a non-allowlisted host even once R2 is configured', () => {
    process.env.NEXT_PUBLIC_MEDIA_HOST = FAKE_R2_HOST;
    const { isSafeMediaUrl } = freshModule();

    expect(isSafeMediaUrl('https://evil.example/tour-images/abc.jpg')).toBe(false);
    // A lookalike host is refused for the same trailing-slash reason the
    // Cloudinary prefix is — this is an exact-host allowlist, not a suffix one.
    expect(isSafeMediaUrl(`${FAKE_R2_HOST}.evil.example/x.jpg`)).toBe(false);
  });

  it('still accepts Cloudinary once R2 is configured — the allowlist only grows', () => {
    process.env.NEXT_PUBLIC_MEDIA_HOST = FAKE_R2_HOST;
    const { isSafeMediaUrl } = freshModule();

    expect(isSafeMediaUrl('https://res.cloudinary.com/demo/image/upload/v1/cover.jpg')).toBe(true);
  });

  it('refuses an R2 URL when the env var is unset, without throwing', () => {
    delete process.env.NEXT_PUBLIC_MEDIA_HOST;
    const { isSafeMediaUrl, safeMediaUrl } = freshModule();

    const url = `${FAKE_R2_HOST}/tour-images/abc.jpg`;
    expect(() => isSafeMediaUrl(url)).not.toThrow();
    expect(isSafeMediaUrl(url)).toBe(false);
    expect(safeMediaUrl(url)).toBeUndefined();
  });

  it('tolerates a trailing slash on the configured host', () => {
    process.env.NEXT_PUBLIC_MEDIA_HOST = `${FAKE_R2_HOST}/`;
    const { isSafeMediaUrl } = freshModule();

    expect(isSafeMediaUrl(`${FAKE_R2_HOST}/tour-images/abc.jpg`)).toBe(true);
  });
});

describe('the read-side and write-side prefixes agree', () => {
  /**
   * `cloudinary-url.ts` declares its own copy of the prefix rather than
   * importing `CLOUDINARY_URL_PREFIX`, because that constant lives under
   * `src/server/admin/` and a PUBLIC page importing from the admin tree would
   * invert the one-way boundary `tour-repository.ts` documents.
   *
   * Duplication is the right call there and the wrong thing to leave unguarded:
   * the failure mode is someone widening one prefix (to add a second CDN, say)
   * and leaving the renderer refusing everything the writer now accepts, which
   * surfaces as images silently not appearing. This test is the cheap half of
   * that trade.
   *
   * It is a TEST-ONLY import, which is why it is allowed to cross the boundary.
   */
  it('accepts exactly what the tour schema accepts', () => {
    expect(isSafeMediaUrl(`${CLOUDINARY_URL_PREFIX}demo/image/upload/v1/x.jpg`)).toBe(true);

    // And the prefix is non-trivial, so the assertion above is not satisfied by
    // an empty string on either side.
    expect(CLOUDINARY_URL_PREFIX).toBe('https://res.cloudinary.com/');
  });
});

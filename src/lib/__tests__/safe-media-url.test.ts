/**
 * @jest-environment node
 */

import { isSafeMediaUrl, safeMediaUrl } from '../cloudinary-url';

/**
 * RENDER-TIME MEDIA URL REFUSAL — L5 of the 2026-09-19 review, still
 * load-bearing after CRM-migration Step 2: `PhotoPlaceholder` and the
 * detail page's gallery links both turn a CRM-returned URL into something
 * a browser fetches or follows, and the CRM's own write-side validation
 * (a separate system this site cannot see) is not a substitute for
 * refusing an unrecognised URL here.
 *
 * The behavioural proof is in `stored-xss-render.test.tsx`, which plants
 * hostile URLs in a rendered page. This file pins the predicate itself.
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

/**
 * CRM-migration Step 5 removed the "read-side and write-side prefixes
 * agree" pinning test that used to live here — it imported
 * `CLOUDINARY_URL_PREFIX` from the admin tour-form schema to prove this
 * file's own copy of the same prefix hadn't drifted from it. That write
 * path (the admin CMS's own upload validation) no longer exists on this
 * site at all; the CRM is a separate system whose write-side validation
 * this site cannot see or pin against. The predicate itself is still
 * covered by every `isSafeMediaUrl`/`safeMediaUrl` case above.
 */

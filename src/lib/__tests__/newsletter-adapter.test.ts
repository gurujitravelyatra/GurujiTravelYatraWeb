import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { submitNewsletterSignup } from '../newsletter-adapter';

/**
 * CRM-migration Step 5: relocated and narrowed from
 * `src/content/adapters/__tests__/not-implemented-lead-adapter.test.ts`
 * (now deleted along with the rest of `src/content/`). The source-branching
 * tests that file ran (newsletter vs. brochure vs. enquiry copy) no longer
 * apply — `submitNewsletterSignup` has exactly one caller and one message,
 * since the other three form types moved to the real CRM pipeline in Step
 * 3. What survives is the part that still matters for THIS function: it
 * never calls out to anything, and its failure copy stays genuinely
 * actionable.
 */

const submission = { email: 'asha@example.com', sourcePageUrl: 'https://example.test/' };

describe('submitNewsletterSignup', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function submit() {
    const resultPromise = submitNewsletterSignup(submission);
    await jest.advanceTimersByTimeAsync(1000);
    return resultPromise;
  }

  it('always resolves {status:"error"} and never throws', async () => {
    await expect(submit()).resolves.toEqual(expect.objectContaining({ status: 'error' }));
  });

  it('never calls fetch, XMLHttpRequest, or any network primitive', async () => {
    // jsdom (jest-environment-jsdom 29) does NOT define `global.fetch`, so
    // `jest.spyOn(global, 'fetch')` throws "Property `fetch` does not exist".
    // Install our own stubs and restore them by hand instead.
    const globalWithNet = globalThis as unknown as Record<string, unknown>;
    const originalFetch = globalWithNet.fetch;
    const originalXhr = globalWithNet.XMLHttpRequest;

    const fetchStub = jest.fn(() => {
      throw new Error('fetch must never be called by submitNewsletterSignup');
    });
    const xhrStub = jest.fn(() => {
      throw new Error('XMLHttpRequest must never be constructed by submitNewsletterSignup');
    });
    globalWithNet.fetch = fetchStub;
    globalWithNet.XMLHttpRequest = xhrStub;

    try {
      await submit();
      expect(fetchStub).not.toHaveBeenCalled();
      expect(xhrStub).not.toHaveBeenCalled();
    } finally {
      globalWithNet.fetch = originalFetch;
      globalWithNet.XMLHttpRequest = originalXhr;
    }
  });

  it('contains no network primitive anywhere in its source (defence in depth)', async () => {
    // The spy test above only proves the *happy path* made no call. This
    // asserts the module text itself never references a network primitive,
    // so a call added behind a branch/condition still gets caught.
    const source = await readFile(path.join(__dirname, '..', 'newsletter-adapter.ts'), 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    expect(code).not.toMatch(/\bfetch\s*\(/);
    expect(code).not.toMatch(/XMLHttpRequest/);
    expect(code).not.toMatch(/\baxios\b/);
    expect(code).not.toMatch(/navigator\.sendBeacon/);
  });

  it('returns genuinely actionable copy — the real phone number, never a blank or generic string', async () => {
    const result = await submit();

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message.length).toBeGreaterThan(0);
      expect(result.message).toMatch(/\+91 90999 57658/);
      expect(result.message).toMatch(/newsletter/i);
    }
  });
});

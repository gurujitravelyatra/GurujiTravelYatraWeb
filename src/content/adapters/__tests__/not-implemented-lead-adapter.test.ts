import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { NotImplementedLeadAdapter, leadAdapter } from '../not-implemented-lead-adapter';
import type { LeadPayload } from '../../ports';

const payload: LeadPayload = {
  name: 'Asha Patel',
  mobile: '9876543210',
  source: 'Enquire Now – Spiti Valley Circuit',
  sourcePageUrl: 'https://example.test/',
  timestamp: new Date().toISOString(),
};

describe('NotImplementedLeadAdapter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function submit(adapter: NotImplementedLeadAdapter) {
    const resultPromise = adapter.submitLead(payload);
    await jest.advanceTimersByTimeAsync(1000);
    return resultPromise;
  }

  it('always resolves {status:"error", retryable:true} and never throws', async () => {
    const adapter = new NotImplementedLeadAdapter();
    await expect(submit(adapter)).resolves.toEqual(expect.objectContaining({ status: 'error', retryable: true }));
  });

  it('never calls fetch, XMLHttpRequest, or any network primitive', async () => {
    // jsdom (jest-environment-jsdom 29) does NOT define `global.fetch`, so
    // `jest.spyOn(global, 'fetch')` throws "Property `fetch` does not exist".
    // Install our own stubs and restore them by hand instead — this also means
    // the assertion still holds if a future Node/jsdom bump starts providing
    // fetch natively.
    // Cast through `unknown` to a plain record: an intersection with
    // `typeof globalThis` would keep the real `XMLHttpRequest` constructor
    // signature and reject a bare jest.fn() stub.
    const globalWithNet = globalThis as unknown as Record<string, unknown>;
    const originalFetch = globalWithNet.fetch;
    const originalXhr = globalWithNet.XMLHttpRequest;

    const fetchStub = jest.fn(() => {
      throw new Error('fetch must never be called by NotImplementedLeadAdapter');
    });
    const xhrStub = jest.fn(() => {
      throw new Error('XMLHttpRequest must never be constructed by NotImplementedLeadAdapter');
    });
    globalWithNet.fetch = fetchStub;
    globalWithNet.XMLHttpRequest = xhrStub;

    try {
      const adapter = new NotImplementedLeadAdapter();
      await submit(adapter);

      expect(fetchStub).not.toHaveBeenCalled();
      expect(xhrStub).not.toHaveBeenCalled();
    } finally {
      globalWithNet.fetch = originalFetch;
      globalWithNet.XMLHttpRequest = originalXhr;
    }
  });

  it('contains no network primitive anywhere in its source (defence in depth)', async () => {
    // The spy test above only proves the *happy path* made no call. This
    // asserts the module text itself never references a network primitive, so
    // a call added behind a branch/condition still gets caught.
    const source = await readFile(
      path.join(__dirname, '..', 'not-implemented-lead-adapter.ts'),
      'utf8'
    );
    // Strip comments — the doc block legitimately says "never calls fetch/axios/XHR".
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

    expect(code).not.toMatch(/\bfetch\s*\(/);
    expect(code).not.toMatch(/XMLHttpRequest/);
    expect(code).not.toMatch(/\baxios\b/);
    expect(code).not.toMatch(/navigator\.sendBeacon/);
    expect(code).not.toMatch(/https?:\/\//);
  });

  it('returns visitor-safe copy that never leaks the internal "CLAUDE.md" reference (BLOCKERS.md Decision B)', async () => {
    const adapter = new NotImplementedLeadAdapter();
    const result = await submit(adapter);

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).not.toMatch(/CLAUDE\.md/i);
      // It must still be genuinely actionable, not a blank/generic string.
      expect(result.message.length).toBeGreaterThan(0);
      expect(result.message).toMatch(/\+91 90999 57658/);
    }
  });

  /**
   * M5: one adapter serves several very different forms, and it used to answer
   * all of them with the enquiry wording — someone who typed an email into the
   * newsletter box was told "Online enquiry submission isn't connected yet",
   * which describes neither what they did nor what to do about it.
   */
  describe('failure copy matches the form the visitor actually used', () => {
    async function submitFrom(source: LeadPayload['source']) {
      const adapter = new NotImplementedLeadAdapter();
      const resultPromise = adapter.submitLead({ ...payload, source });
      await jest.advanceTimersByTimeAsync(1000);
      const result = await resultPromise;
      if (result.status !== 'error') throw new Error('adapter must always fail');
      return result.message;
    }

    it('tells a newsletter subscriber about the newsletter, not about an enquiry', async () => {
      const message = await submitFrom('Newsletter Signup');

      expect(message).toMatch(/newsletter/i);
      expect(message).not.toMatch(/enquiry/i);
    });

    it('tells a brochure requester about the brochure', async () => {
      const message = await submitFrom('Brochure Download – Spiti Valley Circuit');

      expect(message).toMatch(/brochure/i);
      expect(message).not.toMatch(/newsletter/i);
    });

    it('keeps the enquiry wording for enquiry sources', async () => {
      const message = await submitFrom('Enquire Now – Spiti Valley Circuit');

      expect(message).toMatch(/enquiry/i);
    });

    it('stays honest and actionable whatever the source — never a fake success, always the real number', async () => {
      for (const source of [
        'Newsletter Signup',
        'Brochure Download – Spiti Valley Circuit',
        'Enquire Now – Spiti Valley Circuit',
        'Contact Page',
      ] as const) {
        const message = await submitFrom(source);

        expect(message).toMatch(/\+91 90999 57658/);
        expect(message).toMatch(/isn't connected yet|aren't connected yet/);
        expect(message).toMatch(/Placeholder copy/);
      }
    });
  });

  it('the exported singleton `leadAdapter` behaves identically', async () => {
    const resultPromise = leadAdapter.submitLead(payload);
    await jest.advanceTimersByTimeAsync(1000);
    await expect(resultPromise).resolves.toEqual(expect.objectContaining({ status: 'error', retryable: true }));
  });
});

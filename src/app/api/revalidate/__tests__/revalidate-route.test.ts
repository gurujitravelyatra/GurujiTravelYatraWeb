/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

/**
 * `POST /api/revalidate` — the website side of the CRM's "Website
 * revalidation hook" (CRM-migration Step 4).
 *
 * `revalidateTag` is mocked the same way `tour-actions.test.ts` mocks
 * `revalidatePath` — it has meaning only inside a real Next request/render
 * lifecycle, so a unit test asserts on WHAT it was called with, not on any
 * observable cache effect.
 */
const mockRevalidateTag = jest.fn();
jest.mock('next/cache', () => ({
  revalidateTag: (tag: string, profile: unknown) => mockRevalidateTag(tag, profile),
}));

import { POST } from '../route';

const SECRET = 'test-revalidate-secret';

// Hermetic regardless of a real .env's WEBSITE_REVALIDATE_SECRET or test
// run order — each describe block below sets exactly the state it needs.
beforeEach(() => {
  delete process.env.WEBSITE_REVALIDATE_SECRET;
});

function post(body: unknown, headers: Record<string, string> = { 'x-revalidate-secret': SECRET }): NextRequest {
  return new NextRequest('https://gurujitravelyatra.com/api/revalidate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/revalidate — auth', () => {
  it('returns 503 when WEBSITE_REVALIDATE_SECRET is not configured', async () => {
    delete process.env.WEBSITE_REVALIDATE_SECRET;

    const response = await POST(post({ paths: ['tours'] }));
    expect(response.status).toBe(503);
    expect(mockRevalidateTag).not.toHaveBeenCalled();
  });

  it('returns 503 even if the caller sends an empty header — an empty secret never "matches"', async () => {
    delete process.env.WEBSITE_REVALIDATE_SECRET;

    const response = await POST(post({ paths: ['tours'] }, { 'x-revalidate-secret': '' }));
    expect(response.status).toBe(503);
  });
});

describe('POST /api/revalidate — with a configured secret', () => {
  beforeEach(() => {
    process.env.WEBSITE_REVALIDATE_SECRET = SECRET;
    mockRevalidateTag.mockReset();
  });

  afterEach(() => {
    delete process.env.WEBSITE_REVALIDATE_SECRET;
  });

  it('returns 401 for a missing secret header', async () => {
    const response = await POST(post({ paths: ['tours'] }, {}));
    expect(response.status).toBe(401);
    expect(mockRevalidateTag).not.toHaveBeenCalled();
  });

  it('returns 401 for a wrong secret', async () => {
    const response = await POST(post({ paths: ['tours'] }, { 'x-revalidate-secret': 'wrong' }));
    expect(response.status).toBe(401);
    expect(mockRevalidateTag).not.toHaveBeenCalled();
  });

  it('returns 401 for a secret of a different length than expected — never throws on the length mismatch', async () => {
    const response = await POST(
      post({ paths: ['tours'] }, { 'x-revalidate-secret': 'a-much-longer-wrong-secret-value' })
    );
    expect(response.status).toBe(401);
  });

  it('accepts the correct secret and revalidates the requested tags, each prefixed crm:', async () => {
    const response = await POST(post({ paths: ['tours', 'tour:kashmir-paradise'] }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.revalidated).toBe(true);
    expect(mockRevalidateTag).toHaveBeenCalledTimes(2);
    expect(mockRevalidateTag).toHaveBeenCalledWith('crm:tours', { expire: 0 });
    expect(mockRevalidateTag).toHaveBeenCalledWith('crm:tour:kashmir-paradise', { expire: 0 });
  });

  it.each(['departures', 'places', 'site'])('revalidates the contract\'s other documented path %s', async (path) => {
    await POST(post({ paths: [path] }));
    expect(mockRevalidateTag).toHaveBeenCalledWith(`crm:${path}`, { expire: 0 });
  });

  it('accepts (and revalidates) a path the contract does not explicitly list — "e.g." is non-exhaustive', async () => {
    const response = await POST(post({ paths: ['categories'] }));
    expect(response.status).toBe(200);
    expect(mockRevalidateTag).toHaveBeenCalledWith('crm:categories', { expire: 0 });
  });

  /**
   * `{ expire: 0 }` (not the deprecated single-arg form, and not
   * `'max'`/stale-while-revalidate) — the CRM already waited for its own
   * save to commit before calling this, so the next visitor should see
   * fresh data immediately. See `revalidateTag.md`'s own guidance for a
   * webhook/Route-Handler caller (route.ts's comment quotes it).
   */
  it('always revalidates with { expire: 0 }, immediate expiry', async () => {
    await POST(post({ paths: ['tours'] }));
    expect(mockRevalidateTag.mock.calls[0][1]).toEqual({ expire: 0 });
  });

  it('returns 400 for a missing paths array', async () => {
    const response = await POST(post({}));
    expect(response.status).toBe(400);
    expect(mockRevalidateTag).not.toHaveBeenCalled();
  });

  it('returns 400 for an empty paths array', async () => {
    const response = await POST(post({ paths: [] }));
    expect(response.status).toBe(400);
  });

  it('returns 400 for a non-array paths', async () => {
    const response = await POST(post({ paths: 'tours' }));
    expect(response.status).toBe(400);
  });

  it('returns 400 for a paths array containing a non-string', async () => {
    const response = await POST(post({ paths: ['tours', 42] }));
    expect(response.status).toBe(400);
    expect(mockRevalidateTag).not.toHaveBeenCalled();
  });

  it('returns 400 for more than 50 paths — a defensive cap, not a documented limit', async () => {
    const response = await POST(post({ paths: Array.from({ length: 51 }, (_, i) => `tag-${i}`) }));
    expect(response.status).toBe(400);
  });

  it('returns 400 for a body that is not JSON', async () => {
    const response = await POST(post('not json{{'));
    expect(response.status).toBe(400);
  });

  it('never returns a 500 for a wrong secret — that is a caller-configuration problem, not a server fault', async () => {
    const response = await POST(post({ paths: ['tours'] }, { 'x-revalidate-secret': 'wrong' }));
    expect(response.status).not.toBe(500);
  });
});

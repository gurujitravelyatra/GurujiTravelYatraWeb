/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

/**
 * A database error must become a generic 500 — never a stack trace, a table
 * name, or a `P1001` string naming the database host and port.
 *
 * These routes are unauthenticated and public, and the intermittent `P1001`
 * drops observed through the managed Postgres proxy mean this path gets
 * exercised in normal operation rather than only during an incident. So it is
 * tested as a real behaviour, not as defensive decoration.
 */
jest.mock('@/content/content-adapter', () => ({
  contentAdapter: {
    getAllTours: jest.fn().mockRejectedValue(
      new Error("P1001: Can't reach database server at `gty-db.internal:5432`")
    ),
  },
  brochureAdapter: null,
}));

import { GET as getTours } from '../tours/route';

describe('unexpected failures', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('returns a generic 500 and leaks no database detail to the client', async () => {
    const response = await getTours(new NextRequest('http://localhost/api/tours'));
    expect(response.status).toBe(500);

    const body = JSON.stringify(await response.json());

    expect(body).not.toContain('P1001');
    expect(body).not.toContain('gty-db.internal');
    expect(body).not.toContain('5432');
    expect(body).not.toContain('Error');
  });

  it('still logs the real error server-side, rather than swallowing it', async () => {
    await getTours(new NextRequest('http://localhost/api/tours'));

    expect(consoleError).toHaveBeenCalled();
    const logged = consoleError.mock.calls.flat().map(String).join(' ');
    expect(logged).toContain('P1001');
  });

  /**
   * The failure must NOT degrade into `{ data: [] }`. An empty catalogue from a
   * failed query is indistinguishable from a genuinely empty one, which is the
   * quiet-wrong-answer failure mode the composition root's missing-`DATABASE_URL`
   * warning exists to prevent.
   */
  it('does not degrade a failed query into an empty list', async () => {
    const response = await getTours(new NextRequest('http://localhost/api/tours'));
    const body = (await response.json()) as { data?: unknown };

    expect(body.data).toBeUndefined();
  });
});

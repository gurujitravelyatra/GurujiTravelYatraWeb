import { NextResponse } from 'next/server';

/**
 * Shared response shape for every route under `src/app/api`.
 *
 * In a `_`-prefixed folder, which App Router treats as PRIVATE — it is excluded
 * from routing, so this file cannot accidentally become `/api/_lib`.
 *
 * ## One envelope, applied uniformly
 *
 * Success is always `{ data: <payload> }` and failure is always
 * `{ error: <string> }`, never a bare array at the top level. Two reasons, both
 * about not painting the contract into a corner:
 *
 *  1. A bare top-level array has nowhere to grow. The moment a listing needs a
 *     total, a cursor or a "some records are withheld" note, a bare array has to
 *     become an object and every consumer breaks. `{ data: [...] }` absorbs that
 *     as an added sibling key.
 *  2. Success and failure become distinguishable without consulting the status
 *     code, which matters because the most common consumer bug is a `fetch()`
 *     that forgets `res.ok` and treats a 500 body as data.
 */

export interface ApiSuccess<T> {
  data: T;
}

export interface ApiFailure {
  error: string;
  /** Present only on 400s — per-field validation messages. */
  fields?: Record<string, string[]>;
}

export function apiSuccess<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ data }, { status });
}

export function apiFailure(
  status: number,
  error: string,
  fields?: Record<string, string[]>
): NextResponse<ApiFailure> {
  return NextResponse.json(fields ? { error, fields } : { error }, { status });
}

/**
 * Generic 500 body. DELIBERATELY says nothing specific.
 *
 * The thrown value is logged server-side in full by `handleRoute`, but nothing
 * derived from it reaches the client. A raw Prisma error is a database-topology
 * disclosure — `P1001` naming the host and port, a unique-constraint violation
 * naming the table and column — and these routes are unauthenticated and public.
 */
const INTERNAL_ERROR_MESSAGE = 'Something went wrong while loading this content. Please try again.';

/**
 * Wraps a route handler so no thrown value can escape as a stack trace.
 *
 * A CRM call that times out or 5xxs is expected to be hit in normal
 * operation, not only in a crisis, so this is `console.error` and a clean
 * 500 — NOT a swallow that returns an empty list. Returning `{ data: [] }`
 * for a failed CRM fetch would render an empty catalogue that is
 * indistinguishable from a genuinely empty one, which is exactly the class
 * of quiet-wrong-answer this route wraps itself to avoid.
 */
export async function handleRoute(
  routeName: string,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    return await handler();
  } catch (error) {
    console.error(`[api] ${routeName} failed:`, error);
    return apiFailure(500, INTERNAL_ERROR_MESSAGE);
  }
}

/**
 * First value only — `?category=A&category=B` is a malformed link, not a
 * multi-select. Identical rule to `/tour-packages` (`page.tsx#firstValue`), so
 * the page and the API cannot disagree about what a repeated param means.
 */
export function firstValue(params: URLSearchParams, key: string): string | undefined {
  const value = params.get(key);
  return value === null ? undefined : value;
}

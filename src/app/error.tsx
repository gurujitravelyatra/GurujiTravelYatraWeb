'use client';

import Link from 'next/link';

import { GTY_PHONE_DISPLAY, GTY_PHONE_TEL } from '@/lib/gty-contact';

/**
 * Production incident 2026-10-27 (Bug 3) — before this file existed, a
 * thrown render error on any page (the `primaryPlace: null` crash that
 * took down `/` and `/tour-packages` is the confirmed example) reached no
 * boundary at all and fell through to Next's own generic 500/"Application
 * error" page, which carries none of this site's own chrome, contact
 * number or tone. This `error.tsx`, at the app root, wraps every page
 * under `src/app/**` in a React error boundary (Next's own file
 * convention — see node_modules/next/dist/docs/01-app/03-api-reference/
 * 03-file-conventions/error.md) and shows GTY's own degraded state
 * instead.
 *
 * ## Why no `<SiteShell>` here
 *
 * `SiteShell` itself reads the CRM (`getSite()`/`getPlaces()`) — if the
 * ORIGINAL crash was CRM-related (most of this incident's bugs were),
 * re-rendering `SiteShell` inside the error boundary risks a SECOND
 * failure with nothing left to catch it. This page is deliberately
 * static: no CRM call, no fetch, nothing that can itself throw. The phone
 * number below is the same hard-coded fallback `resolveSiteContact()`
 * already falls back to elsewhere, not a new invented one.
 *
 * ## `retry`, not `reset` — re-verified against this Next version's docs
 *
 * This Next version's `error.tsx` convention takes a `retry` prop (stable
 * as of v16.3.0, per that doc's own version history), which re-fetches
 * and re-renders the failed segment — the right tool here, since the
 * underlying cause is almost always fresh CRM data arriving differently
 * on retry, not stale client state. `reset()` (clear error state without
 * re-fetching) exists too but is documented as the less common choice.
 *
 * ## Server-side logging of the REAL error
 *
 * Next deliberately redacts a Server Component error's message from what
 * reaches this Client Component in production (`error.message` becomes
 * generic; `error.digest` is the correlation id) — see that same doc's
 * "Props" section. The real message is already in Railway's server logs
 * by the time this renders: Next logs every thrown Server Component error
 * to the server console by default, and the CRM-specific failures this
 * incident was actually about (`CrmSchemaMismatchError`,
 * `CrmUnexpectedResponseError`) are ALSO explicitly `console.error`'d with
 * the endpoint/field named, inside `@/server/crm/client` itself, before
 * they ever reach this boundary — no PII in either case, since a CRM
 * shape-mismatch message names fields and endpoints, never a visitor's
 * own data.
 */
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-gx text-center">
      <h1 className="text-24 font-extrabold leading-[1.15] text-gty-ink">Something went wrong on our end.</h1>
      <p className="max-w-[440px] text-14 leading-[1.6] text-gty-body">
        We&rsquo;re sorry for the trouble — this page hit a snag loading. Please try again, or call us directly and
        we&rsquo;ll help you from there.
      </p>
      {error.digest && (
        <p className="text-11 text-gty-faint-2">
          Reference: <span className="font-mono">{error.digest}</span>
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-pill border-[1.5px] border-gty-primary bg-gty-primary px-5 py-3 text-13 font-bold text-gty-white shadow-gty-btn"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-pill border border-gty-border-2 px-5 py-3 text-13 font-bold text-gty-ink-soft"
        >
          Back to Home
        </Link>
      </div>
      <p className="text-12 text-gty-subtle">
        Or call us at{' '}
        <a href={`tel:${GTY_PHONE_TEL}`} className="font-semibold text-gty-primary">
          {GTY_PHONE_DISPLAY}
        </a>
      </p>
    </div>
  );
}

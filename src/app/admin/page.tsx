import type { Metadata } from 'next';
import Link from 'next/link';

import { requireAdminSession } from '@/server/auth/session';

import { logoutAction } from './actions';

/**
 * `/admin` — the post-login shell.
 *
 * ## Scope: this page proves the gate works, and nothing else
 *
 * Phase A is auth only. Tour CRUD, brochure/file uploads and the tour schema
 * changes they need are later phases, so this page deliberately ships no
 * management UI at all rather than disabled buttons or "coming soon" cards for
 * screens that do not exist. That is the same discipline BLOCKERS.md Decision H
 * applies to placeholder content: an obvious absence beats a plausible-looking
 * stub.
 *
 * What it does do is establish the two things Phase B needs: a route that is
 * genuinely session-gated, and a place to hang links from.
 */
export const metadata: Metadata = {
  title: 'Dashboard',
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Session-dependent, so never static. Without this, Next could attempt to
 * prerender the admin shell at build time — where there is no session and no
 * request — which is the exact scenario `proxy.ts`'s comment about protecting
 * static routes refers to.
 */
export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  /**
   * THE gate. Not the layout, not the proxy — here, in the page, before anything
   * else runs. See `src/server/auth/session.ts` for why this is repeated per page
   * rather than hoisted.
   */
  const session = await requireAdminSession();

  return (
    <main className="mx-auto w-full max-w-[1080px] px-5 py-12 860:px-8">
      <header className="mb-10 flex flex-col gap-4 border-b border-gty-border pb-8 760:flex-row 760:items-end 760:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-10 font-bold uppercase tracking-label text-gty-primary">
            Guruji Travel Yatra
          </p>
          <h1 className="text-26 font-extrabold leading-tight text-gty-ink">Content admin</h1>
          <p className="text-13-5 text-gty-body">
            Signed in as <span className="font-bold text-gty-ink">{session.email}</span>
          </p>
        </div>

        {/*
          A form posting to a server action, not a button with an onClick. Sign-out
          is a mutation, so it must not be reachable by a GET — a <Link href="/logout">
          is the version of this that a browser prefetcher or a corporate link
          scanner can trigger, signing the user out by merely hovering.
        */}
        <form action={logoutAction}>
          <button
            type="submit"
            className="inline-flex min-h-[42px] items-center justify-center gap-[9px] whitespace-nowrap rounded-pill border-[1.5px] border-gty-border-9 bg-gty-white px-5 py-3 text-11-5 font-bold tracking-btn text-gty-ink transition-[background-color,border-color,color] duration-gty-fast ease-gty hover:border-gty-primary hover:bg-gty-red-50 hover:text-gty-primary focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Log out
          </button>
        </form>
      </header>

      <section className="rounded-22 border border-gty-border bg-gty-white p-8">
        <h2 className="mb-3 text-18 font-extrabold text-gty-ink">Tours</h2>
        <p className="mb-5 max-w-[60ch] text-13-5 leading-relaxed text-gty-body">
          Create, edit, publish and archive the tour catalogue. New tours start as drafts and stay
          invisible to the public site until they are published.
        </p>
        <Link
          href="/admin/tours"
          className="inline-flex min-h-[42px] items-center justify-center gap-[9px] whitespace-nowrap rounded-pill bg-gty-primary px-5 py-3 text-11-5 font-bold tracking-btn text-gty-white transition-[background-color] duration-gty-fast ease-gty hover:bg-gty-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Manage tours
        </Link>
      </section>

      <section className="mt-6 rounded-22 border border-gty-border bg-gty-white p-8">
        <h2 className="mb-3 text-18 font-extrabold text-gty-ink">Not built yet</h2>
        <p className="max-w-[60ch] text-13-5 leading-relaxed text-gty-body">
          Image and brochure uploads are the next phase. The tour form shows those fields, but they
          are disabled and nothing selected in them is stored — tours render a placeholder image
          everywhere on the site until that work lands.
        </p>
      </section>
    </main>
  );
}

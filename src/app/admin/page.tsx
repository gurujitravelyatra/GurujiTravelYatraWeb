import type { Metadata } from 'next';
import Link from 'next/link';

import { requireAdminSession } from '@/server/auth/session';
import { isCloudinaryConfigured } from '@/server/uploads/cloudinary';

import { logoutAction } from './actions';

/**
 * `/admin` — the post-login shell.
 *
 * ## The "Not built yet" panel was itself the thing that went stale
 *
 * Phase A shipped this page with one management link and one honest panel
 * saying uploads were "the next phase", "disabled", and that "nothing selected
 * in them is stored". Every word of that was true on the day it was written and
 * false from Phase C onward — uploads are real, they store, and the tour form's
 * controls are live. Nothing failed when it stopped being true, because prose is
 * what no gate checks (`memory/feedback_qg_stale-invariant-after-fix`).
 *
 * The replacement is deliberately not a second fixed sentence. It reads
 * `isCloudinaryConfigured()` — the SAME function `/api/admin/uploads` and the
 * tour form ask — so this panel describes the environment the admin is actually
 * in rather than the environment whoever last edited it was in. A dashboard that
 * derives its claim cannot go stale the way one that asserts it does.
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

  /**
   * Read on the SERVER, where the credentials are. The boolean crosses to the
   * markup; nothing about the secret — not even its absence — is decided in the
   * browser. Same shape as the `uploadsEnabled` prop the tour form takes.
   */
  const uploadsEnabled = isCloudinaryConfigured();

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
        <h2 className="mb-3 text-18 font-extrabold text-gty-ink">Images &amp; brochures</h2>

        {uploadsEnabled ? (
          <p className="max-w-[60ch] text-13-5 leading-relaxed text-gty-body">
            Cover photos, gallery images and brochure PDFs upload from the tour form and are stored
            against the tour. A tour with no cover photo renders a placeholder everywhere on the
            site — and <strong className="font-bold text-gty-ink">cannot be published</strong>, since
            a cover image is required to publish.
          </p>
        ) : (
          <>
            {/*
              `role="status"` because this is a live environment fact the admin
              needs before they try, not decoration — the same treatment the
              "no content database" panel on `/admin/tours` gets.
            */}
            <p role="status" className="max-w-[60ch] text-13-5 leading-relaxed text-gty-body">
              Uploads are built and working, but{' '}
              <strong className="font-bold text-gty-ink">
                no Cloudinary account is configured in this environment
              </strong>
              , so the upload controls in the tour form are disabled and say so. Set{' '}
              <code className="rounded-6 bg-gty-bg px-[6px] py-[2px] text-13">CLOUDINARY_CLOUD_NAME</code>,{' '}
              <code className="rounded-6 bg-gty-bg px-[6px] py-[2px] text-13">CLOUDINARY_API_KEY</code> and{' '}
              <code className="rounded-6 bg-gty-bg px-[6px] py-[2px] text-13">CLOUDINARY_API_SECRET</code>{' '}
              (see <code className="rounded-6 bg-gty-bg px-[6px] py-[2px] text-13">.env.example</code>) to
              enable them.
            </p>
            <p className="mt-3 max-w-[60ch] text-13-5 leading-relaxed text-gty-body">
              The consequence worth knowing before you start:{' '}
              <strong className="font-bold text-gty-ink">
                no new tour can be published until then
              </strong>
              , because a cover image is required to publish and there is no way to upload one.
              Existing tours are unaffected and stay live.
            </p>
          </>
        )}
      </section>
    </main>
  );
}

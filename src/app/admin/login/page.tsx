import type { Metadata } from 'next';

import { safeReturnPath } from '@/server/auth/admin-route-policy';

import { LoginForm } from './LoginForm';

/**
 * `/admin/login` — the only authentication surface in this application.
 *
 * ## On-brand, but deliberately not "designed"
 *
 * There is no admin mockup in `Documents/Website-Design/`, and there is no admin
 * screen anywhere in the design export — this whole surface postdates it (see
 * `memory/project_gty_admin_reversal.md`). So nothing here is transcribed from a
 * source, and nothing here invents a visual language either. It is built purely
 * from tokens already in `globals.css` and components already in
 * `src/components/ui/`, which is what makes it recognisably the same site as the
 * public pages without any of it being a guess at an unseen design.
 *
 * The layout is deliberately plain: a centred card on the site's background, the
 * wordmark as text, two fields and a button. Phase D can restyle it against a
 * real design; nothing else depends on how it looks.
 *
 * ## No navigation to or from the public site
 *
 * The public header/footer are not rendered here, and there is no "back to
 * site" link. That is not an oversight — `robots.ts` keeps `/admin` out of search
 * results and several public-surface tests assert no public page ever links to
 * `/admin`. A staff member reaches this page by typing the URL or from a
 * bookmark.
 */
export const metadata: Metadata = {
  title: 'Staff sign-in',
  /**
   * Belt and braces alongside `src/app/robots.ts`. `robots.txt` asks a crawler
   * not to FETCH the page; this asks it not to INDEX one it fetched anyway —
   * which is the case that actually matters, because a URL discovered from a
   * link elsewhere can be indexed without ever being crawled.
   */
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Rendered per-request. The page reads `searchParams`, which already forces this,
 * but stating it prevents a future "optimise the admin area" pass from
 * accidentally caching a login page.
 */
export const dynamic = 'force-dynamic';

export default async function AdminLoginPage({
  searchParams,
}: {
  /**
   * Next 16: `searchParams` is a Promise in App Router pages and must be awaited.
   */
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;

  /**
   * `next` is attacker-controlled — anyone can mail a staff member a link with
   * any value in it. `safeReturnPath()` reduces it to a path inside `/admin` or
   * discards it entirely, which is what stops this being an open redirect that
   * borrows the site's credibility. An array (`?next=a&next=b`) is discarded
   * rather than picking one.
   */
  const rawNext = typeof params.next === 'string' ? params.next : null;
  const next = safeReturnPath(rawNext);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gty-bg px-5 py-16">
      <div className="w-full max-w-[420px] rounded-22 border border-gty-border bg-gty-white p-8 shadow-gty-md 640:p-10">
        <header className="mb-8 flex flex-col gap-2">
          <p className="text-10 font-bold uppercase tracking-label text-gty-primary">
            Guruji Travel Yatra
          </p>
          <h1 className="text-22 font-extrabold leading-tight text-gty-ink">Staff sign-in</h1>
          <p className="text-13-5 text-gty-body">
            This area manages website content. If you are planning a trip, everything you need is on
            the main site.
          </p>
        </header>

        <LoginForm next={next} />
      </div>
    </main>
  );
}

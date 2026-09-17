import type { Metadata } from 'next';

/**
 * Shell for every `/admin` route, INCLUDING `/admin/login`.
 *
 * ## There is deliberately no auth check in this layout
 *
 * That looks like the obvious place for one, and it is the wrong place, for two
 * reasons Next's own authentication guide spells out:
 *
 * 1. A layout does not re-run on client-side navigation, so a session that
 *    expires mid-visit would not be noticed by a check that ran once.
 * 2. A layout does not control whether its children render. Route segments are
 *    rendered by the router, so a layout that redirects does not stop the page
 *    beneath it from executing or from appearing in the RSC payload.
 *
 * And a third, specific to this tree: `/admin/login` is nested under `/admin`, so
 * a layout-level gate would have to special-case the login page to avoid
 * redirecting a logged-out user away from the only page that can log them in.
 *
 * The gate is therefore `requireAdminSession()` called by each page and each
 * server action (`src/server/auth/session.ts`), with `proxy.ts` in front as an
 * optimistic pre-filter. This layout only provides chrome.
 */
export const metadata: Metadata = {
  /**
   * Applies to `/admin` and everything under it. The public site's own
   * `robots.txt` rule lives in `src/app/robots.ts`; this is the per-page meta
   * that also covers a URL a crawler reached without reading robots.txt.
   */
  robots: { index: false, follow: false, nocache: true },
  title: {
    default: 'Admin · Guruji Travel Yatra',
    template: '%s · GTY Admin',
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  /**
   * No `<html>`/`<body>` — those come from the root layout, which also supplies
   * the Archivo/Caveat font variables this tree's tokens depend on.
   *
   * The root layout also mounts `ModalProvider`/`ModalHost` (the public site's
   * enquiry modals). They are inert here: nothing in `/admin` calls `useModal()`,
   * and `ModalHost` renders null until a variant is active. Not worth a
   * route-group split to avoid, and a split would mean two root layouts and two
   * copies of the font setup.
   */
  return <div className="min-h-screen bg-gty-bg text-gty-ink">{children}</div>;
}

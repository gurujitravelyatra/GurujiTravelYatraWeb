import Image from 'next/image';
import Link from 'next/link';

/**
 * BLOCKERS.md Decision G. Next.js's built-in 404 handler — NOT a route
 * (tech spec acceptance criterion 9 and E2E test 10 both still hold: no new
 * route is created here).
 *
 * Decision G2 narrowed what lands here. `/group-tours`, `/customize-tours`
 * and `/about-us` were the original motivating cases and are now REAL PAGES —
 * a branded 404 turned out to be an acceptable landing for a footer link to an
 * unbuilt policy page, but not for a top-level nav item. What still lands here
 * by design is the Footer-only set (`/destinations`, `/our-services`,
 * `/travel-guide`, `/contact-us`) and the `/legal/*` slugs that have no page
 * yet.
 *
 * Deliberately minimal per the resolution — headline, one line of copy, two
 * links back to the routes that actually exist. No content is invented
 * beyond that (no fabricated sitemap, no search box, no "recently viewed").
 *
 * COPY: this handler serves EVERY 404 — the not-yet-built routes that ship
 * dead by design, but equally a typo, a stale bookmark, or a link someone
 * made up. "This page is coming soon." asserted a roadmap commitment for all
 * of them, which is false for most. The headline states the only thing that
 * is true in every case; the body mentions the coming-soon possibility
 * without promising it.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-gx py-16 text-center">
      <Image src="/logo/gty-logo.png" alt="Guruji Travel Yatra" width={74} height={74} className="h-[64px] w-[64px] object-cover object-top" />

      <div className="flex flex-col gap-2">
        <p className="text-11 font-bold uppercase tracking-eyebrow-3 text-gty-primary">404</p>
        <h1 className="text-29 font-extrabold tracking-tightest text-gty-ink 760:text-36">Page not found.</h1>
        <p className="max-w-[440px] text-14 leading-[1.6] text-gty-body">
          We couldn&#39;t find that page. The address may be mistyped or out of date — or the page may be one we
          haven&#39;t built yet.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="inline-flex min-h-[42px] items-center justify-center gap-[9px] whitespace-nowrap rounded-pill border-[1.5px] border-gty-primary bg-gty-primary px-6 py-3 text-11-5 font-bold tracking-btn text-gty-white shadow-gty-btn transition-[background-color,transform] duration-gty-fast ease-gty hover:-translate-y-px hover:bg-gty-primary-deep"
        >
          Back to Home
        </Link>
        <Link
          href="/tour-packages"
          className="inline-flex min-h-[42px] items-center justify-center gap-[9px] whitespace-nowrap rounded-pill border-[1.5px] border-gty-border-9 bg-gty-white px-6 py-3 text-11-5 font-bold tracking-btn text-gty-ink transition-colors duration-gty-fast ease-gty hover:border-gty-primary hover:text-gty-primary"
        >
          Browse Tour Packages
        </Link>
      </div>
    </div>
  );
}

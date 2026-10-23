import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requireAdminSession } from '@/server/auth/session';
import { getAdminTourBySlug, listDestinationOptions } from '@/server/admin/tours/tour-repository';
import { isCloudinaryConfigured } from '@/server/uploads/cloudinary';
import { departureWithholdReason, publicWithholdReason } from '@/content/public-listing';
import { TourForm } from '@/components/admin/TourForm';

export const metadata: Metadata = {
  title: 'Edit tour',
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = 'force-dynamic';

/**
 * `/admin/tours/[id]/edit`.
 *
 * ## `[id]` IS the slug
 *
 * `Tour`'s primary key is its slug — every model in this schema keys tours that
 * way, and adding a second surrogate identifier purely for admin URLs would mean
 * two identities for one row, with every child table referencing one of them and
 * the admin UI the other.
 *
 * The cost is that editing a slug changes this page's own URL, so
 * `saveTourAction` redirects to the new one after a rename. The segment keeps
 * the name `[id]` because that is the route the spec asked for, and because
 * "the tour's identifier" is what it means.
 */
interface EditTourPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function EditTourPage({ params, searchParams }: EditTourPageProps) {
  await requireAdminSession();

  const { id } = await params;
  const query = await searchParams;

  const [tour, destinations] = await Promise.all([getAdminTourBySlug(id), listDestinationOptions()]);

  if (!tour.configured || !destinations.configured) {
    return (
      <main className="mx-auto w-full max-w-[860px] px-5 py-12 860:px-8">
        <p role="status" className="rounded-18 border border-gty-border bg-gty-white px-6 py-8 text-14 text-gty-body">
          No content database is configured, so tours cannot be edited here.
        </p>
      </main>
    );
  }

  /**
   * A 404 for a slug that does not exist — including one that USED to exist and
   * was renamed. Unlike the public detail route there is no withholding subtlety
   * here: an admin may see every tour, so "not found" means genuinely absent.
   */
  if (tour.value === null) notFound();

  const { form, lifecycle, updatedAt } = tour.value;

  const saved = typeof query.saved === 'string' ? query.saved : undefined;

  /**
   * THE one question this page kept answering wrongly: is this tour actually
   * reachable by a visitor?
   *
   * Answered by calling the PUBLIC site's own predicate on this tour's real
   * lifecycle columns — not by reading `lifecycle === 'PUBLISHED'`, which is a
   * display flattening that knows nothing about `pricingUnverified`. Every
   * claim below ("View on site", the post-save message, the banner) is derived
   * from this one value, so they cannot disagree with the site or with each
   * other.
   */
  const withheld = publicWithholdReason(tour.value);
  const liveOnPublicSite = withheld === null;

  /**
   * The same question for this tour's BATCHES, answered by the departure half
   * of the same gate — which differs on purpose: a price-unconfirmed tour's
   * batches ARE listed (marked), per BLOCKERS.md item 9.
   */
  const departureReason = departureWithholdReason(tour.value);
  const departureVisibility = departureReason === null ? 'LISTED' : departureReason === 'ARCHIVED' ? 'ARCHIVED' : 'DRAFT';

  return (
    <main className="mx-auto w-full max-w-[860px] px-5 py-12 860:px-8">
      <header className="mb-8 flex flex-col gap-3 border-b border-gty-border pb-6">
        <Link
          href="/admin/tours"
          className="text-11-5 font-bold uppercase tracking-label text-gty-subtle transition-colors duration-gty-fast ease-gty hover:text-gty-primary"
        >
          ← Tours
        </Link>
        <h1 className="text-26 font-extrabold leading-tight text-gty-ink">{form.name}</h1>

        <p className="flex flex-wrap items-center gap-3 text-12-5 text-gty-body">
          <span
            className={`inline-flex items-center rounded-pill border px-[10px] py-[4px] text-11-5 font-bold ${
              lifecycle === 'PUBLISHED'
                ? 'border-gty-green-border bg-gty-green-bg text-gty-green-text'
                : 'border-gty-border-9 bg-gty-bg text-gty-body'
            }`}
          >
            {lifecycle === 'PUBLISHED' ? 'Published' : lifecycle === 'DRAFT' ? 'Draft' : 'Archived'}
          </span>
          <span>
            Last updated <time dateTime={updatedAt.toISOString()}>{updatedAt.toISOString().slice(0, 10)}</time>
          </span>
          {/*
            The link is offered ONLY when the page it points at exists.

            It used to appear for any `lifecycle === 'PUBLISHED'` tour, which
            includes every `pricingUnverified` one — and `/tour-packages/[slug]`
            calls `notFound()` for those, so the admin's own "View on site" link
            was a 404 they had no way to explain. A link that is broken by
            construction is worse than no link: it reads as a bug in the site
            rather than as a deliberate withholding.
          */}
          {liveOnPublicSite && (
            <a
              href={`/tour-packages/${form.slug}`}
              className="font-bold text-gty-primary underline"
              target="_blank"
              rel="noreferrer"
            >
              View on site ↗
            </a>
          )}
        </p>

        {/*
          An archived tour stays editable — it is still a real record and the
          reason it was archived may be something being fixed. But the state has
          to be stated, or an admin edits it, presses Publish, and cannot work out
          why it is still not on the site.
        */}
        {lifecycle === 'ARCHIVED' && (
          <p role="status" className="rounded-12 border border-gty-border-9 bg-gty-bg px-4 py-3 text-12-5 text-gty-body">
            <strong className="font-bold text-gty-ink">This tour is archived.</strong> It is hidden from the
            public site regardless of its publish status, and from the default tour list. Restore it from the
            tours list to make it eligible to appear again.
          </p>
        )}

        {/*
          CRM-migration decision 1 removed the `PRICE_UNCONFIRMED` withhold
          reason — the banner that used to render here explained a tour
          withheld from the public site for an unconfirmed price, which can
          no longer happen (`publicWithholdReason()` never returns that
          value any more; see `src/content/public-listing.ts`). Draft and
          archived tours still have their own explanations above.
        */}

        {saved && (
          <p role="status" className="rounded-12 border border-gty-green-border bg-gty-green-bg px-4 py-3 text-12-5 text-gty-green-text">
            {/*
              DERIVED, not asserted. The old message said "Saved and published.
              This tour is now visible on the public site." on the strength of
              the submit intent alone — a sentence the code had no basis for,
              and one that was simply false for every withheld tour.

              `liveOnPublicSite` is the public gate's own answer, so this line
              cannot drift from what a visitor actually gets.
            */}
            {saved === 'publish'
              ? liveOnPublicSite
                ? 'Saved and published. This tour is now visible on the public site.'
                : 'Saved and published in the CMS — but it is still NOT visible on the public site. See the reason above.'
              : 'Saved as a draft. This tour is not visible on the public site.'}
          </p>
        )}
      </header>

      <TourForm
        destinations={destinations.value}
        editingSlug={form.slug}
        defaultValues={form}
        isPublished={lifecycle === 'PUBLISHED'}
        publishBlocked={query.publishBlocked === '1'}
        uploadsEnabled={isCloudinaryConfigured()}
        versionToken={updatedAt.toISOString()}
        departureVisibility={departureVisibility}
        departureMarkers={tour.value.departureMarkers}
        tourPricingUnverified={tour.value.pricingUnverified}
      />
    </main>
  );
}

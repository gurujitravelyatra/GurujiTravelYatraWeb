import type { Metadata } from 'next';
import Link from 'next/link';

import { requireAdminSession } from '@/server/auth/session';
import { listAdminTours, type ListToursFilter, type TourStatusFilter } from '@/server/admin/tours/tour-repository';
import { CATEGORY_VALUES } from '@/server/admin/tours/tour-form-schema';
import { publicWithholdReason } from '@/content/public-listing';
import { PhotoPlaceholder } from '@/components/ui/photo-placeholder';
import type { DestinationCategory } from '@/content/types';

import { setTourArchivedAction, setTourPublishedAction } from './actions';
import { TourFilterBar } from './TourFilterBar';

export const metadata: Metadata = {
  title: 'Tours',
  robots: { index: false, follow: false, nocache: true },
};

/** Session-dependent and database-backed — never prerendered. */
export const dynamic = 'force-dynamic';

const STATUS_FILTERS: TourStatusFilter[] = ['ALL', 'PUBLISHED', 'DRAFT', 'ARCHIVED'];

function isStatusFilter(value: string | undefined): value is TourStatusFilter {
  return value !== undefined && (STATUS_FILTERS as string[]).includes(value);
}

function isCategory(value: string | undefined): value is DestinationCategory {
  return value !== undefined && (CATEGORY_VALUES as readonly string[]).includes(value);
}

interface AdminToursPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const LIFECYCLE_STYLES: Record<string, string> = {
  PUBLISHED: 'border-gty-green-border bg-gty-green-bg text-gty-green-text',
  DRAFT: 'border-gty-border-9 bg-gty-bg text-gty-body',
  ARCHIVED: 'border-gty-border-9 bg-gty-white text-gty-faint',
};

/**
 * `/admin/tours` — the tour list.
 *
 * ## This page reads through the ADMIN repository, not `contentAdapter`
 *
 * `contentAdapter` applies `isPubliclyListable()` and would therefore show the
 * admin only the tours that are already live — i.e. never the draft they just
 * created. `listAdminTours()` deliberately bypasses that gate, which is safe
 * because this module is `/admin`-only and gated below, and is exactly why that
 * repository is `server-only` and off-limits to public code.
 */
export default async function AdminToursPage({ searchParams }: AdminToursPageProps) {
  // THE gate — before anything reads a tour. Not the layout, not the proxy.
  await requireAdminSession();

  const params = await searchParams;
  const statusParam = firstValue(params.status);
  const categoryParam = firstValue(params.category);
  const search = firstValue(params.q)?.trim() ?? '';

  /**
   * An unrecognised value falls back to the default view rather than erroring.
   * These params come from this page's own controls, so a bad one is a hand-
   * edited URL, and the sane response is the default list — the opposite call
   * from `/api/tours`, which 400s, because there the caller is a machine that
   * needs to know its query was wrong.
   */
  const filter: ListToursFilter = {
    status: isStatusFilter(statusParam) ? statusParam : undefined,
    category: isCategory(categoryParam) ? categoryParam : 'ALL',
    search: search || undefined,
  };

  const tours = await listAdminTours(filter);

  return (
    <main className="mx-auto w-full max-w-[1180px] px-5 py-12 860:px-8">
      <header className="mb-8 flex flex-col gap-4 border-b border-gty-border pb-6 760:flex-row 760:items-end 760:justify-between">
        <div className="flex flex-col gap-2">
          <Link
            href="/admin"
            className="text-11-5 font-bold uppercase tracking-label text-gty-subtle transition-colors duration-gty-fast ease-gty hover:text-gty-primary"
          >
            ← Dashboard
          </Link>
          <h1 className="text-26 font-extrabold leading-tight text-gty-ink">Tours</h1>
        </div>

        <Link
          href="/admin/tours/new"
          className="inline-flex min-h-[42px] items-center justify-center gap-[9px] whitespace-nowrap rounded-pill bg-gty-primary px-5 py-3 text-11-5 font-bold tracking-btn text-gty-white transition-[background-color] duration-gty-fast ease-gty hover:bg-gty-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          + New Tour
        </Link>
      </header>

      {!tours.configured ? (
        <section className="rounded-22 border border-gty-border bg-gty-white p-8" role="status">
          <h2 className="mb-3 text-18 font-extrabold text-gty-ink">No content database configured</h2>
          <p className="max-w-[60ch] text-13-5 leading-relaxed text-gty-body">
            <code className="rounded-6 bg-gty-bg px-[6px] py-[2px] text-13">DATABASE_URL</code> is not set, so
            there are no tours to manage here and nothing can be saved. The public site is serving its
            built-in fixture catalogue.
          </p>
        </section>
      ) : (
        <>
          <TourFilterBar
            statusFilters={STATUS_FILTERS}
            categories={CATEGORY_VALUES}
            activeStatus={statusParam ?? ''}
            activeCategory={categoryParam ?? ''}
            search={search}
          />

          <p className="mb-4 mt-6 text-13 text-gty-subtle" role="status">
            {tours.value.length === 1 ? '1 tour' : `${tours.value.length} tours`}
            {filter.status === undefined ? ' (archived tours are hidden — filter by Archived to see them)' : ''}
          </p>

          {tours.value.length === 0 ? (
            <p className="rounded-18 border border-gty-border bg-gty-white px-6 py-10 text-center text-14 text-gty-body">
              No tours match these filters.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-18 border border-gty-border bg-gty-white">
              <table className="w-full min-w-[860px] border-collapse text-left">
                <caption className="sr-only">
                  Tours, with publication status and per-row publish and archive actions
                </caption>
                <thead>
                  <tr className="border-b border-gty-border text-11 uppercase tracking-label text-gty-subtle">
                    <th scope="col" className="px-4 py-3 font-bold">
                      Tour
                    </th>
                    <th scope="col" className="px-4 py-3 font-bold">
                      Category
                    </th>
                    <th scope="col" className="px-4 py-3 font-bold">
                      Price
                    </th>
                    <th scope="col" className="px-4 py-3 font-bold">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 font-bold">
                      Last updated
                    </th>
                    <th scope="col" className="px-4 py-3 font-bold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tours.value.map((tour) => (
                    <tr key={tour.slug} className="border-b border-gty-border-4 last:border-b-0">
                      <th scope="row" className="px-4 py-4 font-normal">
                        <span className="flex items-center gap-3">
                          {/*
                            The REAL uploaded cover when the tour has one, and
                            the token-coloured placeholder when it does not —
                            routed through `PhotoPlaceholder`, the same component
                            every public card uses, so the admin sees precisely
                            what a visitor would rather than a proxy for it.

                            This replaced a hard-coded emoji tile sitting under a
                            comment that asserted "No cover images exist yet —
                            uploads are Phase C". True when written, false since
                            Phase C shipped, and nothing failed when it stopped
                            being true: an admin who uploaded a cover could not
                            tell from this screen whether it had taken.
                          */}
                          <PhotoPlaceholder
                            photoKey={tour.photoKey}
                            imageUrl={tour.coverImageUrl ?? undefined}
                            alt=""
                            className="h-[42px] w-[56px] shrink-0 rounded-8"
                          />
                          <span className="flex flex-col gap-[2px]">
                            <span className="text-14 font-bold text-gty-ink">{tour.name}</span>
                            <span className="text-12 text-gty-subtle">/{tour.slug}</span>
                          </span>
                        </span>
                      </th>
                      <td className="px-4 py-4 text-13 text-gty-body">{tour.category}</td>
                      <td className="px-4 py-4 text-13 text-gty-body">
                        {tour.pricingTierCount > 0 ? (
                          <span>
                            {tour.pricingTierCount} {tour.pricingTierCount === 1 ? 'tier' : 'tiers'}
                          </span>
                        ) : (
                          <span>{tour.priceFrom || <span className="text-gty-faint">No price</span>}</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {/*
                          THE PILL IS NOT THE WHOLE TRUTH, and this cell now says
                          so. `lifecycle` is a flattening of `status`/`archivedAt`
                          for display; whether a visitor can actually reach the
                          tour is `publicWithholdReason()`, the public site's own
                          predicate, called here on the row's real columns.

                          A `pricingUnverified` tour is PUBLISHED in the CMS and
                          withheld by that gate, so it used to render a green
                          "Published" pill and nothing else — the admin's only
                          view of the catalogue disagreed with the site and
                          neither side reported it.
                        */}
                        <span className="flex flex-col items-start gap-[6px]">
                          <span
                            className={`inline-flex items-center rounded-pill border px-[10px] py-[4px] text-11-5 font-bold ${
                              LIFECYCLE_STYLES[tour.lifecycle]
                            }`}
                          >
                            {tour.lifecycle === 'PUBLISHED'
                              ? 'Published'
                              : tour.lifecycle === 'DRAFT'
                                ? 'Draft'
                                : 'Archived'}
                          </span>

                          {/*
                            Shown only for the reason the pill does NOT already
                            state. A draft's pill says "Draft" and an archived
                            tour's says "Archived"; re-stating those underneath
                            would be noise on every row and would train the eye
                            to skip the one line that carries new information.
                          */}
                          {publicWithholdReason(tour) === 'PRICE_UNCONFIRMED' && (
                            <span className="inline-flex items-center rounded-pill border border-gty-border-9 bg-gty-bg px-[10px] py-[4px] text-11 font-bold text-gty-primary">
                              Withheld from the public site — price unconfirmed
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-13 text-gty-body">
                        <time dateTime={tour.updatedAt.toISOString()}>
                          {tour.updatedAt.toISOString().slice(0, 10)}
                        </time>
                      </td>
                      <td className="px-4 py-4">
                        <span className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/admin/tours/${tour.slug}/edit`}
                            className="rounded-8 border border-gty-border-9 px-[10px] py-[6px] text-12 font-bold text-gty-ink transition-colors duration-gty-fast ease-gty hover:border-gty-primary hover:text-gty-primary"
                          >
                            Edit
                          </Link>

                          {/*
                            Forms posting to server actions, never links. Each of
                            these is a MUTATION, and a <Link> is the version a
                            browser prefetcher or a corporate link scanner can
                            fire by merely hovering — the same reasoning the
                            dashboard's log-out form records.
                          */}
                          {tour.lifecycle !== 'ARCHIVED' && (
                            <form action={setTourPublishedAction}>
                              <input type="hidden" name="slug" value={tour.slug} />
                              <input
                                type="hidden"
                                name="publish"
                                value={tour.lifecycle === 'PUBLISHED' ? 'false' : 'true'}
                              />
                              {/*
                                The label names what the button DOES, which for a
                                withheld tour is not what "Publish" means anywhere
                                else on this screen: it moves `status` and the
                                tour still does not appear. Saying "Publish" there
                                is the same over-claim as the green pill, one
                                click further along.

                                `title` carries the reason rather than a longer
                                label, so the column does not reflow for one row.
                              */}
                              <button
                                type="submit"
                                title={
                                  tour.pricingUnverified
                                    ? 'This tour’s price is unconfirmed, so the public site withholds it. Publishing changes its CMS status only — it will not appear on the site.'
                                    : undefined
                                }
                                className="rounded-8 border border-gty-border-9 px-[10px] py-[6px] text-12 font-bold text-gty-ink transition-colors duration-gty-fast ease-gty hover:border-gty-primary hover:text-gty-primary"
                              >
                                {tour.lifecycle === 'PUBLISHED'
                                  ? 'Unpublish'
                                  : tour.pricingUnverified
                                    ? 'Publish in CMS only'
                                    : 'Publish'}
                              </button>
                            </form>
                          )}

                          <form action={setTourArchivedAction}>
                            <input type="hidden" name="slug" value={tour.slug} />
                            <input
                              type="hidden"
                              name="archived"
                              value={tour.lifecycle === 'ARCHIVED' ? 'false' : 'true'}
                            />
                            <button
                              type="submit"
                              className="rounded-8 border border-gty-border-9 px-[10px] py-[6px] text-12 font-bold text-gty-body transition-colors duration-gty-fast ease-gty hover:border-gty-primary hover:text-gty-primary"
                            >
                              {tour.lifecycle === 'ARCHIVED' ? 'Restore' : 'Archive'}
                            </button>
                          </form>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </main>
  );
}

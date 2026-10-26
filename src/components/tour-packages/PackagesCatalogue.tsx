'use client';

import { useRouter, useSearchParams } from 'next/navigation';

import type { CrmCategory, CrmPlace, CrmTourCard } from '@/server/crm/types';
import { PackageCard } from '@/components/cards/PackageCard';
import { gridColumnsForCount } from '@/lib/card-grid';
import { cn } from '@/lib/utils';
import { PackagesFilterBar } from './PackagesFilterBar';

export interface PackagesCatalogueProps {
  tours: CrmTourCard[];
  total: number;
  page: number;
  pageSize: number;
  categories: CrmCategory[];
  places: CrmPlace[];
  months: string[];
  selectedCategory: CrmCategory | 'All';
  selectedPlace: string | 'All';
  selectedMonth: string | 'All';
}

/**
 * CRM-migration Step 2 — REDESIGNED around `GET /public/tours`'s real
 * server-side filters (`category`, `place`, `month`, `page`), replacing the
 * old "4 themed rails + client-side array filtering" model. The CRM has no
 * concept of rail membership, so there is now ONE results grid; filtering
 * and pagination are both real HTTP requests (via a URL change that
 * re-renders the Server Component page with new `getTours()` params), not
 * client-side state over a pre-fetched array.
 */
export function PackagesCatalogue({
  tours,
  total,
  page,
  pageSize,
  categories,
  places,
  months,
  selectedCategory,
  selectedPlace,
  selectedMonth,
}: PackagesCatalogueProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function pushParams(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined || value === 'All') params.delete(key);
      else params.set(key, value);
    }
    // Any filter change restarts pagination — page 2 of the OLD filter is
    // not a meaningful place to land on the new one.
    if (!('page' in next)) params.delete('page');

    // `.size` is not reliably implemented across every URLSearchParams
    // polyfill/jsdom version this project's test suite runs under — a
    // string-length check is the portable equivalent.
    const query = params.toString();
    router.push(query.length > 0 ? `/tour-packages?${query}` : '/tour-packages');
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="relative z-[4] -mt-[70px] px-gx">
        <PackagesFilterBar
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={(category) => pushParams({ category: category === 'All' ? undefined : category })}
          places={places}
          selectedPlace={selectedPlace}
          onSelectPlace={(place) => pushParams({ place: place === 'All' ? undefined : place })}
          months={months}
          selectedMonth={selectedMonth}
          onSelectMonth={(month) => pushParams({ month: month === 'All' ? undefined : month })}
          visibleCount={tours.length}
          totalCount={total}
          onClear={() => router.push('/tour-packages')}
        />
      </div>

      <div data-testid="packages-results" className="flex flex-col gap-4 px-gx py-[26px]">
        {tours.length === 0 ? (
          <p className="mx-gx rounded-16 border border-dashed border-gty-border-8 bg-gty-surface-3 px-4 py-8 text-center text-14 text-gty-subtle">
            No journeys match this filter yet.
          </p>
        ) : (
          <div data-testid="packages-grid" className={cn('grid gap-5', gridColumnsForCount(tours.length))}>
            {tours.map((tour) => (
              <PackageCard key={tour.slug} tour={tour} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <nav aria-label="Tour packages pagination" className="flex items-center justify-center gap-3 pt-4">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => pushParams({ page: String(page - 1) })}
              className="rounded-pill border border-gty-border-2 px-5 py-2 text-13 font-bold text-gty-ink-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Previous
            </button>
            <span className="text-13 text-gty-subtle">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => pushParams({ page: String(page + 1) })}
              className="rounded-pill border border-gty-border-2 px-5 py-2 text-13 font-bold text-gty-ink-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next →
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}

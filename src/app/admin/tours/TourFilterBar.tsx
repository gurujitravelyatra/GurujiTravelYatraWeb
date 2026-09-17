import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface TourFilterBarProps {
  statusFilters: readonly string[];
  categories: readonly string[];
  activeStatus: string;
  activeCategory: string;
  search: string;
}

const STATUS_LABELS: Record<string, string> = {
  ALL: 'All (incl. archived)',
  PUBLISHED: 'Published',
  DRAFT: 'Draft',
  ARCHIVED: 'Archived',
};

/**
 * Status/category/search filters for `/admin/tours`.
 *
 * ## A plain GET form, and no `'use client'`
 *
 * This is a Server Component that renders an uncontrolled `<form method="get">`.
 * The filters therefore live in the URL, which buys three things a `useState`
 * version would have to rebuild: the filtered view is linkable and bookmarkable
 * (an admin can keep a "drafts" tab open), the back button works, and the page
 * needs no client JavaScript at all.
 *
 * It also keeps the filtering where the data is. The list page reads these same
 * params and passes them to `listAdminTours()`, so narrowing happens in SQL
 * rather than by shipping every tour to the browser and hiding rows — which
 * matters here beyond performance: a client-side filter would mean draft and
 * archived rows are present in the DOM of any view that appears to exclude
 * them.
 */
export function TourFilterBar({
  statusFilters,
  categories,
  activeStatus,
  activeCategory,
  search,
}: TourFilterBarProps) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-4 rounded-18 border border-gty-border bg-gty-white p-4">
      <div className="flex min-w-[180px] flex-col gap-2">
        <Label htmlFor="tour-filter-status">Status</Label>
        <select
          id="tour-filter-status"
          name="status"
          defaultValue={activeStatus}
          className="min-h-[42px] rounded-10 border border-gty-border-9 bg-gty-white px-3 text-13-5 text-gty-ink"
        >
          {/*
            The empty option is the DEFAULT view and is labelled for what it
            actually does. "Active" rather than "All": this view hides archived
            tours, and calling it All beside a separate "All (incl. archived)"
            option would make one of the two labels a lie.
          */}
          <option value="">Active (default)</option>
          {statusFilters.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status] ?? status}
            </option>
          ))}
        </select>
      </div>

      <div className="flex min-w-[180px] flex-col gap-2">
        <Label htmlFor="tour-filter-category">Category</Label>
        <select
          id="tour-filter-category"
          name="category"
          defaultValue={activeCategory}
          className="min-h-[42px] rounded-10 border border-gty-border-9 bg-gty-white px-3 text-13-5 text-gty-ink"
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      <div className="flex min-w-[220px] flex-1 flex-col gap-2">
        <Label htmlFor="tour-filter-search">Search</Label>
        <Input
          id="tour-filter-search"
          name="q"
          type="search"
          defaultValue={search}
          placeholder="Name or slug"
        />
      </div>

      <button
        type="submit"
        className="inline-flex min-h-[42px] items-center justify-center rounded-pill border-[1.5px] border-gty-border-9 bg-gty-white px-5 text-11-5 font-bold tracking-btn text-gty-ink transition-colors duration-gty-fast ease-gty hover:border-gty-primary hover:text-gty-primary focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Apply
      </button>
    </form>
  );
}

import Link from 'next/link';

import type { Package } from '@/content/types';
import { PhotoPlaceholder } from '@/components/ui/photo-placeholder';

export interface PackageCardProps {
  package: Package;
}

/**
 * `.tcard`/`.pcard` — export lines 197-215. Used for Home's "Popular
 * Destinations" grid and all four Tour Packages rails (same visual card).
 *
 * Per BLOCKERS.md Decision D, the card is a `<Link>` to the (in-scope)
 * `/tour-packages/[slug]` detail route. Per Decision E, the heart, category
 * pill and photo-count badge stay as non-interactive `<span>`s exactly as
 * the export has them — that's what makes wrapping the whole card in a
 * `<Link>` valid DOM (no nested interactive elements).
 */
export function PackageCard({ package: pkg }: PackageCardProps) {
  return (
    <Link
      href={`/tour-packages/${pkg.slug}`}
      className="group flex w-full flex-col overflow-hidden rounded-18 bg-gty-white p-[6px] pb-[14px] text-left shadow-gty-card transition-[box-shadow,transform] duration-gty-card ease-gty hover:-translate-y-[3px] hover:shadow-gty-card-hover"
    >
      <span className="relative block w-full">
        <PhotoPlaceholder
          photoKey={pkg.photoUrl}
          alt={`${pkg.name} — ${pkg.destinationSlug.replace(/-/g, ' ')}`}
          className="h-[250px] w-full rounded-14"
        />
        <span className="absolute left-[10px] top-[10px] flex items-center gap-[6px] rounded-pill bg-gty-white/94 py-[6px] pl-[9px] pr-3 text-12-5 font-semibold text-gty-ink-soft shadow-gty-dark-sm">
          <span aria-hidden="true" className="flex text-gty-primary">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
              <path d="M9 3h6v2h3a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h3V3zm2 2v1h2V5h-2zm-1 5v2h4v-2h-4z" />
            </svg>
          </span>
          {pkg.category}
        </span>
        <span
          aria-hidden="true"
          className="absolute right-[10px] top-[10px] flex h-[30px] w-[30px] items-center justify-center rounded-pill bg-gty-white text-gty-primary shadow-gty-dark-sm"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
            <path d="M12 20s-7.5-4.6-7.5-9.4A4.1 4.1 0 0 1 12 7.6a4.1 4.1 0 0 1 7.5 3C19.5 15.4 12 20 12 20z" />
          </svg>
        </span>
        <span className="absolute bottom-3 right-[10px] flex items-center gap-[6px] rounded-8 bg-gty-overlay-dark px-[10px] py-[5px] text-12 font-semibold text-gty-white">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
            <path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm2 11h14l-4.5-6-3.5 4.5-2.5-3L5 16zm11-6.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />
          </svg>
          {pkg.photosCount} Photos
        </span>
      </span>

      <span className="flex w-full flex-col gap-2 px-[10px] pb-[6px] pt-[14px]">
        <span className="flex items-center gap-[7px] text-13-5 text-gty-body">
          <span aria-hidden="true" className="flex text-gty-subtle">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
              <path d="M7 2h2v2h6V2h2v2h2a1 1 0 0 1 1 1v3H3V5a1 1 0 0 1 1-1h2V2zM3 9h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9zm3 3v2h2v-2H6zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2zm-8 4v2h2v-2H6zm4 0v2h2v-2h-2z" />
            </svg>
          </span>
          {pkg.durationLabel}
        </span>
        <span className="text-19 font-extrabold leading-[1.2] tracking-tightest text-gty-ink">{pkg.name}</span>
        <span className="text-14 leading-[1.4] text-gty-body">{pkg.subtitle}</span>
        <span className="mt-1 h-px bg-gty-border-4" />
        {pkg.savingsLabel && (
          <span className="flex">
            <span className="flex items-center gap-[7px] rounded-9 border border-gty-green-border bg-gty-green-bg px-[13px] py-[7px] text-13-5 font-bold text-gty-green-text">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
                <path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1.2 14.2l6-6-1.5-1.4-4.5 4.5-2.3-2.3-1.4 1.4 3.7 3.8z" />
              </svg>
              Save ₹{pkg.savingsLabel}
            </span>
          </span>
        )}
        <span className="flex items-center justify-between gap-[10px] pt-2">
          <span className="flex items-baseline gap-[9px]">
            <span className="text-23 font-extrabold text-gty-primary">{pkg.priceFrom}</span>
            {pkg.priceWas && <span className="text-14 text-gty-faint line-through">{pkg.priceWas}</span>}
          </span>
          <span
            aria-hidden="true"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-pill bg-gty-red-200 text-gty-primary"
          >
            <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
              <path d="M13 5l7 7-7 7-1.4-1.4L16.2 13H4v-2h12.2l-4.6-4.6z" />
            </svg>
          </span>
        </span>
      </span>
    </Link>
  );
}

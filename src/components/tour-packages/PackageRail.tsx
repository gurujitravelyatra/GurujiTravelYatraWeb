'use client';

import type { Package } from '@/content/types';
import { PackageCard } from '@/components/cards/PackageCard';
import { useHorizontalOverflow } from '@/hooks/use-horizontal-overflow';

export interface PackageRailProps {
  title: string;
  items: Package[];
  background: 'white' | 'cream';
  /**
   * Clears every active filter and returns the visitor to the results — see
   * `PackagesCatalogue.handleViewAll`. Required, not optional: this button
   * shipped as a `<button type="button">` with no handler at all, four times
   * per page, and making the prop mandatory means a caller cannot reintroduce
   * that by omission.
   */
  onViewAll: () => void;
}

/** How far the row scrolls per arrow click — one card width (300px) + its gap (20px). */
const SCROLL_AMOUNT_PX = 320;

/**
 * Export lines 396-427, tech spec §4.4 "Four package rails". `use client`
 * for the scroll-arrow button (§4.5). Right-edge arrow only ≥1080px, matching
 * the export's `.pkart{display:none}` rule at that breakpoint — AND only when
 * the row actually overflows (see `canScroll`).
 *
 * Defensive empty state (BLOCKERS.md Decision C): even though no chip
 * empties the WHOLE page, an individual rail absolutely can end up with 0
 * items under a given category filter (e.g. "Beach" only matches 1 item in
 * the South India rail — the other 3 rails render this empty state).
 */
export function PackageRail({ title, items, background, onViewAll }: PackageRailProps) {
  // The arrow renders only when the row genuinely overflows — see the hook.
  const { ref: rowRef, hasOverflow: canScroll } = useHorizontalOverflow<HTMLDivElement>([items]);

  const scrollNext = () => {
    rowRef.current?.scrollBy({ left: SCROLL_AMOUNT_PX, behavior: 'smooth' });
  };

  return (
    <div
      className={
        background === 'white'
          ? 'flex flex-col gap-4 px-gx pb-2 pt-[26px]'
          : 'flex flex-col gap-4 bg-gty-surface-5 px-gx pb-2 pt-[26px]'
      }
    >
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h3 className="text-27 font-extrabold tracking-tightest text-gty-ink">{title}</h3>
        <button
          type="button"
          onClick={onViewAll}
          className="flex items-center gap-2 text-14 font-bold text-gty-primary transition-[text-decoration] duration-gty-fast ease-gty hover:underline"
        >
          View All Packages <span aria-hidden="true">→</span>
        </button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-16 border border-dashed border-gty-border-8 bg-gty-surface-3 px-4 py-6 text-center text-13-5 text-gty-subtle">
          No journeys match this filter yet.
        </p>
      ) : (
        <div className="flex items-center gap-3">
          <div ref={rowRef} className="no-scrollbar flex gap-5 overflow-x-auto px-px py-[6px] pb-[14px]">
            {items.map((item) => (
              <div key={item.slug} className="w-[250px] flex-none 760:w-[300px]">
                <PackageCard package={item} />
              </div>
            ))}
          </div>
          {canScroll && (
            <button
              type="button"
              onClick={scrollNext}
              aria-label={`Scroll ${title}`}
              className="hidden h-[38px] w-[38px] flex-none items-center justify-center rounded-pill border border-gty-border-3 text-gty-primary transition-colors duration-gty-fast ease-gty hover:border-gty-primary hover:bg-gty-primary hover:text-gty-white 1080:flex"
            >
              ›
            </button>
          )}
        </div>
      )}
    </div>
  );
}

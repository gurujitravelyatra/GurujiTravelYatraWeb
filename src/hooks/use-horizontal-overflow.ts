'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/**
 * 1px tolerance: sub-pixel layout rounding otherwise reports a 1px "overflow"
 * on a row that visibly fits, which would keep the arrow on screen forever.
 */
const OVERFLOW_TOLERANCE_PX = 1;

export interface HorizontalOverflow<T extends HTMLElement> {
  /** Attach to the scrolling row. */
  ref: RefObject<T | null>;
  /** True only while the row genuinely has somewhere to scroll to. */
  hasOverflow: boolean;
}

/**
 * Whether a horizontally-scrolling row actually overflows its container — i.e.
 * whether a "scroll right" affordance would do anything if it were shown.
 *
 * WHY THIS EXISTS: both card rails on this site drew their arrow purely from a
 * breakpoint (`1080:flex` / `1180:flex`). Once the three `pricingUnverified`
 * tours were withheld from every public listing, the Trending rail dropped to 2
 * cards and still offered a "Scroll Trending Tour Packages" button that
 * scrolled nothing — focusable, announced to screen readers, completely inert.
 * That is the same defect class as the dead "View All Packages" buttons this
 * codebase already fixed once, so it is fixed once here rather than twice in
 * two components that would drift apart.
 *
 * MEASURED, never inferred from `items.length`: how many cards fit depends on
 * the viewport, the card's own breakpoint (250px → 300px at 760px) and the gap,
 * so any item-count threshold is wrong at some width. `scrollWidth >
 * clientWidth` is the literal condition for "there is somewhere to scroll to".
 *
 * Starts `false` so the server render and the first client paint agree (no
 * hydration mismatch) and so no arrow is ever shown and then taken away.
 *
 * `deps` re-measures when the row's contents change — filtering the catalogue
 * swaps the cards without remounting the rail.
 */
export function useHorizontalOverflow<T extends HTMLElement>(deps: readonly unknown[] = []): HorizontalOverflow<T> {
  const ref = useRef<T>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  const measure = useCallback(() => {
    const row = ref.current;
    setHasOverflow(row !== null && row.scrollWidth - row.clientWidth > OVERFLOW_TOLERANCE_PX);
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
    // `deps` is the caller's content signal; `measure` is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, ...deps]);

  return { ref, hasOverflow };
}

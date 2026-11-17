'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';

import type { CrmTourCard } from '@/server/crm/types';
import { PopularDestinationCard } from './PopularDestinationCard';
import { Reveal } from './Reveal';

export interface TourRailSectionProps {
  /** Small uppercase line above the heading — omitted when the section has no approved copy for one. */
  eyebrow?: string;
  /** The `<h2>` content (plain words + the red italic accent). */
  title: ReactNode;
  /** Accessible name of the row itself, e.g. "Popular Destinations tours". */
  railLabel: string;
  viewAllLabel: string;
  viewAllHref: string;
  tours: CrmTourCard[];
  /** True when the section has more published tours than `tours` holds — the row then ends with a "View all tours" card. */
  hasMore?: boolean;
  /** Section spacing/background — the two home rails share everything else. */
  className: string;
  sectionTestId?: string;
  railTestId?: string;
}

/** Sub-pixel rounding otherwise reports a 1px "overflow" on a row that visibly fits. */
const EDGE_TOLERANCE_PX = 2;
/** Mouse movement below this is a click, not a drag. */
const DRAG_THRESHOLD_PX = 6;

/**
 * Round 3 (2026-11-17), Parts 1 / 1b / 2 — the ONE tour row both home rails
 * ("Popular Destinations" and "Explore Destinations") render through, so
 * their container, gutters, card width, gap, radius and shadow cannot drift
 * apart again (they were two separate layouts before: a wrapping grid and a
 * fixed-width scroller in a different container).
 *
 * One horizontal, scroll-snapping row at every width:
 *  - below 768px: cards are ~66vw (230-280px), so about one and a half show;
 *  - 768px+: 2 / 3 / 4 full cards per view (md / lg / xl), using the same
 *    card width and 20px gap the old grid had, so the first view is unchanged.
 *
 * The row's own padding + matching negative margin leaves room for the card
 * shadow and hover lift (an `overflow-x: auto` box clips vertically too),
 * without moving anything: the content box stays exactly the container width,
 * which is also what the percentage card widths resolve against.
 *
 * Arrows only exist when the row MEASURABLY overflows (never from a card
 * count — how many fit depends on the viewport), and only from 768px up,
 * where there is a mouse to need them.
 */
export function TourRailSection({
  eyebrow,
  title,
  railLabel,
  viewAllLabel,
  viewAllHref,
  tours,
  hasMore = false,
  className,
  sectionTestId,
  railTestId,
}: TourRailSectionProps) {
  const rowRef = useRef<HTMLUListElement>(null);
  const dragRef = useRef<{ startX: number; startLeft: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const settleTimerRef = useRef<number | null>(null);
  const [edges, setEdges] = useState({ overflow: false, atStart: true, atEnd: true });
  const [dragging, setDragging] = useState(false);

  const measure = useCallback(() => {
    const row = rowRef.current;
    if (!row) return;
    const max = row.scrollWidth - row.clientWidth;
    const next = {
      overflow: max > EDGE_TOLERANCE_PX,
      atStart: row.scrollLeft <= EDGE_TOLERANCE_PX,
      atEnd: row.scrollLeft >= max - EDGE_TOLERANCE_PX,
    };
    setEdges((prev) =>
      prev.overflow === next.overflow && prev.atStart === next.atStart && prev.atEnd === next.atEnd ? prev : next
    );
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    };
  }, [measure, tours, hasMore]);

  /** Width of one full view (the visible cards + one gap) and of one card + gap. */
  const metrics = () => {
    const row = rowRef.current;
    if (!row) return { view: 0, card: 0, padLeft: 0 };
    const style = getComputedStyle(row);
    const padLeft = parseFloat(style.paddingLeft) || 0;
    const padRight = parseFloat(style.paddingRight) || 0;
    const gap = parseFloat(style.columnGap) || 0;
    const first = row.firstElementChild as HTMLElement | null;
    return {
      view: row.clientWidth - padLeft - padRight + gap,
      card: (first?.getBoundingClientRect().width ?? 0) + gap,
      padLeft,
    };
  };

  const scrollByAmount = (amount: number) => {
    rowRef.current?.scrollBy({ left: amount, behavior: 'smooth' });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    scrollByAmount((event.key === 'ArrowRight' ? 1 : -1) * metrics().card);
  };

  // Click-and-drag for a mouse only — touch and trackpads already scroll the row natively.
  const onPointerDown = (event: PointerEvent<HTMLUListElement>) => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || !rowRef.current) return;
    dragRef.current = { startX: event.clientX, startLeft: rowRef.current.scrollLeft, moved: false };
  };

  const onPointerMove = (event: PointerEvent<HTMLUListElement>) => {
    const drag = dragRef.current;
    const row = rowRef.current;
    if (!drag || !row) return;
    const delta = event.clientX - drag.startX;
    if (!drag.moved) {
      if (Math.abs(delta) < DRAG_THRESHOLD_PX) return;
      drag.moved = true;
      setDragging(true);
      row.setPointerCapture?.(event.pointerId);
    }
    row.scrollLeft = drag.startLeft - delta;
  };

  const endDrag = () => {
    const drag = dragRef.current;
    const row = rowRef.current;
    dragRef.current = null;
    if (!drag?.moved || !row) return;
    // The click that ends a drag must not follow the card's link.
    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
    // Snapping is off while dragging (it would fight the pointer); glide to the
    // nearest card edge first, then hand control back to scroll-snap.
    const { padLeft } = metrics();
    const max = row.scrollWidth - row.clientWidth;
    let target = 0;
    let best = Number.POSITIVE_INFINITY;
    for (const child of Array.from(row.children) as HTMLElement[]) {
      const left = Math.min(child.offsetLeft - padLeft, max);
      const distance = Math.abs(left - row.scrollLeft);
      if (distance < best) {
        best = distance;
        target = left;
      }
    }
    row.scrollTo({ left: target, behavior: 'smooth' });
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    settleTimerRef.current = window.setTimeout(() => setDragging(false), 450);
  };

  const showArrows = edges.overflow;
  const arrowClass =
    'grid h-11 w-11 flex-none place-items-center rounded-full border border-stone-200/80 bg-white text-redux-crimson shadow-[0_10px_25px_-12px_rgba(28,25,23,0.35)] transition-all duration-300 hover:-translate-y-0.5 hover:border-redux-crimson/40 disabled:pointer-events-none disabled:opacity-35';

  return (
    <section data-testid={sectionTestId} className={className}>
      <div className="mx-auto max-w-[1320px]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <Reveal>
            {eyebrow && (
              <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-widest2 text-redux-crimson">
                <span aria-hidden="true" className="h-1.5 w-1.5 rotate-45 bg-redux-crimson" />
                {eyebrow}
              </span>
            )}
            <h2 className={`${eyebrow ? 'mt-3 ' : ''}font-redux-display text-4xl font-medium tracking-tight text-stone-900 sm:text-5xl`}>{title}</h2>
          </Reveal>
          <Reveal delay={0.1} className="flex items-center gap-3">
            <Link
              href={viewAllHref}
              className="group inline-flex items-center gap-2 rounded-full border border-stone-300 px-5 py-2.5 text-sm font-bold text-stone-800 transition-all duration-300 hover:-translate-y-0.5 hover:border-redux-crimson hover:bg-redux-crimson hover:text-white"
            >
              {viewAllLabel}
              <ArrowUpRight size={16} className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
            {showArrows && (
              <span className="hidden items-center gap-2 md:flex">
                <button
                  type="button"
                  aria-label={`Previous ${railLabel}`}
                  disabled={edges.atStart}
                  onClick={() => scrollByAmount(-metrics().view)}
                  className={arrowClass}
                >
                  <ChevronLeft size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`Next ${railLabel}`}
                  disabled={edges.atEnd}
                  onClick={() => scrollByAmount(metrics().view)}
                  className={arrowClass}
                >
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              </span>
            )}
          </Reveal>
        </div>

        <div className="mt-10">
          {/* A scrollable row has to be reachable by keyboard, so the list itself takes focus for the arrow keys. */}
          <ul
            ref={rowRef}
            role="list"
            aria-label={railLabel}
            tabIndex={0}
            data-testid={railTestId}
            data-dragging={dragging || undefined}
            onScroll={measure}
            onKeyDown={onKeyDown}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onDragStart={(event) => event.preventDefault()}
            onClickCapture={(event) => {
              if (!suppressClickRef.current) return;
              event.preventDefault();
              event.stopPropagation();
            }}
            className="no-scrollbar -mx-4 -mb-14 -mt-4 flex snap-x snap-mandatory list-none gap-4 overflow-x-auto overscroll-x-contain scroll-px-4 px-4 pb-14 pt-4 outline-none [-webkit-overflow-scrolling:touch] focus-visible:ring-2 focus-visible:ring-redux-crimson/40 data-[dragging]:cursor-grabbing data-[dragging]:select-none data-[dragging]:snap-none sm:-mx-6 sm:scroll-px-6 sm:px-6 md:-mx-5 md:-mb-20 md:scroll-px-5 md:gap-5 md:px-5 md:pb-20"
          >
            {tours.map((tour, index) => (
              <li
                key={tour.slug}
                className="w-[clamp(230px,66vw,280px)] flex-none snap-start md:w-[calc((100%-1.25rem)/2)] lg:w-[calc((100%-2.5rem)/3)] xl:w-[calc((100%-3.75rem)/4)]"
              >
                <Reveal delay={index < 4 ? Math.min(index * 0.12, 0.4) : 0} className="h-full">
                  <PopularDestinationCard tour={tour} />
                </Reveal>
              </li>
            ))}
            {hasMore && (
              <li className="w-[clamp(230px,66vw,280px)] flex-none snap-start md:w-[calc((100%-1.25rem)/2)] lg:w-[calc((100%-2.5rem)/3)] xl:w-[calc((100%-3.75rem)/4)]">
                <Link
                  href={viewAllHref}
                  className="group flex h-full min-h-[280px] flex-col items-center justify-center gap-4 rounded-[1.75rem] border border-dashed border-redux-crimson/40 bg-redux-cream p-6 text-center transition-all duration-500 hover:-translate-y-2 hover:border-redux-crimson hover:shadow-[0_35px_70px_-30px_rgba(127,18,22,0.45)]"
                >
                  <span
                    aria-hidden="true"
                    className="grid h-12 w-12 place-items-center rounded-full bg-redux-crimson text-white transition-transform duration-300 group-hover:translate-x-1"
                  >
                    <ArrowRight size={20} />
                  </span>
                  <span className="font-redux-display text-xl font-semibold text-stone-900">View all tours</span>
                </Link>
              </li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}

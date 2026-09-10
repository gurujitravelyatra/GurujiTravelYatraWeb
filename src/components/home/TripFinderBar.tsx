'use client';

import { useState } from 'react';
import Link from 'next/link';

import { tripFinderTabs } from '@/content/fixtures/tabs.fixture';
import { cn } from '@/lib/utils';

/**
 * Export lines 177-188, tech spec §4.4 row 3. Overlaps the hero's bottom
 * edge via a negative top margin.
 *
 * Tabs are the only genuinely interactive piece (local active-tab state +
 * hint copy, §4.5). The 3 fields row is presentational — the export itself
 * wires every field here to `onClick="{{ noop }}"`, and Open Question Q2
 * explicitly defers real destination/availability querying to a later
 * sprint. Rendering them as real dropdown controls (rather than the
 * export's own inert `.fld` boxes) would require a shadcn `Select` this
 * repo doesn't have yet and would still have nowhere real to submit to —
 * kept pixel-accurate and inert instead, matching the Tour Packages page's
 * identical fields.
 */
export function TripFinderBar() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeTab = tripFinderTabs[activeIndex];

  return (
    <div
      data-testid="section-3-trip-finder"
      className="relative z-[5] mx-gx -mt-2 flex flex-col rounded-16 border border-gty-border bg-gty-white shadow-gty-header 760:-mt-6"
    >
      <div className="flex flex-wrap gap-6 border-b border-gty-border-6 px-4 pt-3">
        {tripFinderTabs.map((tab, index) => (
          <button
            key={tab.name}
            type="button"
            onClick={() => setActiveIndex(index)}
            aria-pressed={index === activeIndex}
            className={cn(
              'whitespace-nowrap border-b-2 border-transparent pb-[10px] pt-1 text-13 font-bold text-gty-subtle transition-colors duration-gty-fast ease-gty hover:text-gty-ink',
              index === activeIndex && 'border-gty-primary text-gty-primary'
            )}
          >
            {tab.name}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 px-4 py-[14px]">
        <div className="flex min-w-[170px] flex-[2] items-center justify-between rounded-12 border border-gty-border-2 bg-gty-surface-3 px-4 py-[13px] text-12 text-gty-placeholder">
          Where do you want to go? <span aria-hidden="true">⌕</span>
        </div>
        <div className="flex min-w-[130px] flex-1 items-center justify-between rounded-12 border border-gty-border-2 bg-gty-surface-3 px-4 py-[13px] text-12 text-gty-placeholder">
          Journey Month <span aria-hidden="true">▤</span>
        </div>
        <div className="flex min-w-[120px] flex-1 items-center justify-between rounded-12 border border-gty-border-2 bg-gty-surface-3 px-4 py-[13px] text-12 text-gty-placeholder">
          2 Travellers <span aria-hidden="true">▾</span>
        </div>
        <Link
          href="/tour-packages"
          className="inline-flex min-h-[42px] items-center justify-center gap-[9px] whitespace-nowrap rounded-pill border-[1.5px] border-gty-primary bg-gty-primary px-5 py-3 text-11-5 font-bold tracking-btn text-gty-white shadow-gty-btn transition-[background-color,transform] duration-gty-fast ease-gty hover:-translate-y-px hover:bg-gty-primary-deep"
        >
          Explore Now <span aria-hidden="true">→</span>
        </Link>
      </div>
      <p className="px-4 pb-[14px] text-11-5 text-gty-subtle">{activeTab.hint}</p>
    </div>
  );
}

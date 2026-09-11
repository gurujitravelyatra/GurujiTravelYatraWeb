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
 * sprint. They are rendered as visibly-unavailable fields (see
 * `DecorativeField`) rather than as inputs a visitor might try to type into:
 * an inert control that looks functional is worse than an honest one that
 * says "Soon". Real destination filtering exists one click away, on
 * `/tour-packages` (`PackagesFilterBar`'s destination select).
 *
 * NOTE for future copy edits: the "Explore Now" CTA below is the SAME static
 * `/tour-packages` link on every tab — the active tab changes only the hint
 * line. `/tour-packages` takes no category query param either (its filter is
 * local `useState` in `PackagesCatalogue`, defaulting to "All"). So no hint
 * in `tabs.fixture.ts` may claim the button lands on a pre-filtered or
 * tab-specific result set. See that file's COPY FIDELITY RULE header.
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
        {/*
          These three are NOT WIRED and now say so. They are the export's own
          inert `.fld` boxes; rendering them as crisp, solid-bordered controls
          made them read as a working search form that silently swallowed
          intent. Dashed border + "Soon" + `aria-disabled` so neither a sighted
          visitor nor a screen-reader user is told they can search here. The
          "Explore Now" CTA beside them is the real, working control.
        */}
        <DecorativeField className="min-w-[170px] flex-[2]" label="Where do you want to go?" glyph="⌕" />
        <DecorativeField className="min-w-[130px] flex-1" label="Journey Month" glyph="▤" />
        <DecorativeField className="min-w-[120px] flex-1" label="2 Travellers" glyph="▾" />
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

/**
 * A field the export draws but nothing implements. Presented as explicitly
 * unavailable rather than as an empty input: `aria-disabled` for assistive
 * tech, a dashed border and a "Soon" tag for everyone else.
 */
function DecorativeField({ className, label, glyph }: { className?: string; label: string; glyph: string }) {
  return (
    <div
      aria-disabled="true"
      data-testid={`trip-finder-field-${label}`}
      className={cn(
        'flex items-center justify-between gap-2 rounded-12 border border-dashed border-gty-border-2 bg-gty-surface-3 px-4 py-[13px] text-12 text-gty-placeholder',
        className
      )}
    >
      <span className="truncate">{label}</span>
      <span className="flex flex-none items-center gap-2">
        <span className="text-9 font-bold uppercase tracking-label text-gty-subtle">Soon</span>
        <span aria-hidden="true">{glyph}</span>
      </span>
    </div>
  );
}

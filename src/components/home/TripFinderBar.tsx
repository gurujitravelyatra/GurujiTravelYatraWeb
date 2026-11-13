'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Calendar, ChevronDown, MapPin, Users } from 'lucide-react';

import { tripFinderTabs, type TripFinderTab } from '@/lib/trip-finder-tabs';
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
 * "Redux" redesign (brief §5, 2026-11-14): sliding active-tab pill via
 * `layoutId` (framer-motion), restyled fields/CTA. The tab/hint/deep-link
 * MECHANICS below are untouched — see `__tests__/TripFinderBar.test.tsx`.
 *
 * NOTE for future copy edits: the "Explore Now" CTA below now DEEP-LINKS per
 * tab — `/tour-packages?category=<tab.category>` for the three tabs that map
 * onto a real derived chip, plain `/tour-packages` for the two that do not.
 *
 * The previous version of this note claimed "`/tour-packages` takes no category
 * query param either", and every tab shared one static link. That stopped being
 * true when the route started reading `?category=`/`?destination=` from
 * `searchParams` — so the hints could honestly say "filter by Spiritual on Tour
 * Packages" while the button dropped the visitor on the unfiltered catalogue
 * and left them to find the chip themselves. The International rail's "View All
 * International Tours" link and the footer's Top Destinations column already
 * deep-linked; this bar was the last surface that did not.
 *
 * A hint may still only claim what the tab's own `category` can back: an
 * unrecognised value is validated away to "All" server-side
 * (`resolveCategory`), so a made-up category would silently produce exactly the
 * unfiltered page the old comment described. See `tabs.fixture.ts`'s COPY
 * FIDELITY RULE header.
 */

/** The catalogue URL a tab's CTA points at — filtered when the tab maps to a real chip. */
function ctaHref(tab: TripFinderTab): string {
  return tab.category ? `/tour-packages?category=${encodeURIComponent(tab.category)}` : '/tour-packages';
}

export function TripFinderBar() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeTab = tripFinderTabs[activeIndex];

  return (
    <section className="relative z-20 bg-redux-cream px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 36 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        data-testid="section-3-trip-finder"
        className="mx-auto max-w-6xl rounded-[2rem] border border-stone-200/80 bg-white p-5 shadow-[0_40px_80px_-40px_rgba(127,18,22,0.3)] sm:p-7"
      >
        <div className="flex gap-1 overflow-x-auto border-b border-stone-100 pb-3 no-scrollbar sm:gap-2">
          {tripFinderTabs.map((tab, index) => (
            <button
              key={tab.name}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-pressed={index === activeIndex}
              className={cn(
                'relative shrink-0 rounded-full px-4 py-2.5 text-[13px] font-bold transition-colors duration-300 sm:px-5 sm:text-sm',
                index === activeIndex ? 'text-white' : 'text-redux-ink-soft hover:text-redux-crimson'
              )}
            >
              {index === activeIndex && (
                <motion.span
                  layoutId="finder-tab-pill"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  className="absolute inset-0 rounded-full bg-redux-crimson shadow-[0_10px_22px_-8px_rgba(220,38,38,0.65)]"
                />
              )}
              <span className="relative">{tab.name}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[1.5fr_1fr_1fr_auto] md:items-stretch">
          {/*
            These three are NOT WIRED and now say so. They are the export's own
            inert `.fld` boxes; rendering them as crisp, solid-bordered controls
            made them read as a working search form that silently swallowed
            intent. A "SOON" chip + `aria-disabled` so neither a sighted
            visitor nor a screen-reader user is told they can search here. The
            "Explore Now" CTA beside them is the real, working control.
          */}
          <DecorativeField icon={<MapPin size={17} />} label="Where do you want to go?" soon />
          <DecorativeField icon={<Calendar size={17} />} label="Journey Month" soon />
          <DecorativeField icon={<Users size={17} />} label="2 Travellers" soon chevron />
          <Link
            href={ctaHref(activeTab)}
            data-testid="trip-finder-cta"
            className="btn-shine group flex items-center justify-center gap-2.5 rounded-2xl bg-redux-crimson px-8 py-3.5 text-[15px] font-bold text-white shadow-[0_18px_35px_-14px_rgba(220,38,38,0.7)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-redux-crimson-dark"
          >
            Explore Now
            <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>
        <p className="mt-4 flex items-start gap-2 text-[13px] leading-relaxed text-redux-ink-mute">{activeTab.hint}</p>
      </motion.div>
    </section>
  );
}

/**
 * A field the export draws but nothing implements. Presented as explicitly
 * unavailable rather than as an empty input: `aria-disabled` for assistive
 * tech, a "SOON" chip and a disabled-looking chevron (select-style fields
 * only) for everyone else. All three fields get the chip — the component's
 * own long-standing contract above is that none of them are wired, the
 * destination field included (real destination filtering is one click away
 * on `/tour-packages`, not here).
 */
function DecorativeField({
  icon,
  label,
  soon,
  chevron,
}: {
  icon: React.ReactNode;
  label: string;
  soon?: boolean;
  chevron?: boolean;
}) {
  return (
    <div
      aria-disabled="true"
      data-testid={`trip-finder-field-${label}`}
      className="relative flex items-center gap-3 rounded-2xl border border-stone-200 bg-redux-cream px-4 py-3.5 transition-colors duration-300 hover:border-redux-crimson/40"
    >
      <span className="text-redux-crimson">{icon}</span>
      <span className="w-full truncate text-[15px] font-medium text-stone-900">{label}</span>
      {soon && (
        <span className="flex-none rounded-full border border-stone-200 px-2 py-0.5 text-[9px] font-bold tracking-[0.2em] text-stone-400">
          SOON
        </span>
      )}
      {chevron && <ChevronDown size={16} className="pointer-events-none flex-none text-stone-400" />}
    </div>
  );
}

import { Compass } from 'lucide-react';

export interface RouteMarqueeProps {
  /**
   * Real CRM place names, never invented — the caller (`page.tsx`) passes
   * the SAME `liveTourCount > 0` filtered subset `DestinationsRail` uses,
   * not every place the CRM returns: this strip is promotional, and a place
   * with no live tours should not be promoted anywhere on the page.
   */
  places: readonly string[];
}

/**
 * "Redux" redesign (brief §4) — scrolling destination-name strip directly
 * under the hero. The reference hardcodes its own 6 sample names; this
 * renders real CRM place names instead (brief's own "keep our live data"
 * instruction), falling back to the brief's own fallback list only when the
 * CRM has not returned any places yet — never a fabricated destination.
 *
 * Pure CSS animation (`animate-redux-marquee`, globals.css), not
 * framer-motion — a looping translateX has no interactive state framer-motion
 * would add value for, and CSS already honours `prefers-reduced-motion`
 * globally (globals.css's `@media (prefers-reduced-motion: reduce)` block
 * forces every animation/transition to ~0 duration).
 *
 * Server Component: no hooks, no interactivity.
 */
const FALLBACK_PLACES = ['Kedarnath', 'Tirupati', 'Rameswaram', 'Varanasi', 'Ujjain', 'Shirdi'] as const;

export function RouteMarquee({ places }: RouteMarqueeProps) {
  const names = places.length > 0 ? places : FALLBACK_PLACES;
  // Two identical sequences back to back so `translateX(-50%)` loops seamlessly.
  const sequences = [names, names];

  return (
    <div className="relative overflow-hidden border-b border-stone-100 bg-white py-4">
      <div className="flex w-max animate-redux-marquee">
        {sequences.map((sequence, seqIndex) => (
          <div key={seqIndex} className="flex items-center" aria-hidden={seqIndex > 0}>
            {sequence.map((name, index) => (
              <span key={`${seqIndex}-${name}-${index}`} className="flex items-center">
                <span className="whitespace-nowrap px-8 font-redux-display text-2xl font-medium italic text-stone-900 sm:text-3xl">
                  {name}
                </span>
                <Compass size={16} className="shrink-0 text-redux-crimson" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

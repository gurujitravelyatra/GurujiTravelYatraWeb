import type { CSSProperties } from 'react';
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
 * instruction).
 *
 * Brief §A8 (2026-11-14): the strip looked half-empty with only 2-3 real
 * CRM places. Real places are now ALWAYS kept (never dropped for having a
 * fallback name available) and topped up with the brief's own 12-name
 * fallback list — deduplicated, never truncated below 12 distinct names —
 * so there is always enough text for one sequence to clear the viewport at
 * 1920px. The names are then repeated as many whole times as needed so ONE
 * sequence's rendered width is never narrower than a very wide viewport
 * (measured, not guessed: `MIN_SEQUENCE_CHARS` is a deliberately generous
 * lower bound on characters-per-sequence, since this is a Server Component
 * with no DOM to measure against).
 *
 * Pure CSS animation (`animate-redux-marquee`, globals.css), not
 * framer-motion — a looping translateX has no interactive state framer-motion
 * would add value for, and CSS already honours `prefers-reduced-motion`
 * globally (globals.css's `@media (prefers-reduced-motion: reduce)` block
 * forces every animation/transition to ~0 duration). The scroll SPEED is
 * still dynamic (brief: 7s per name) via an inline `--marquee-duration`
 * custom property, which `--animate-redux-marquee` in globals.css now reads
 * instead of a fixed 48s.
 *
 * Server Component: no hooks, no interactivity.
 */
const FALLBACK_PLACES = [
  'Kedarnath',
  'Tirupati',
  'Rameswaram',
  'Varanasi',
  'Ujjain',
  'Shirdi',
  'Vaishno Devi',
  'Amarnath',
  'Badrinath',
  'Dwarka',
  'Shimla - Manali',
  'Haridwar',
] as const;

const MIN_DISTINCT_NAMES = 12;
/** Conservative average rendered width per name (incl. gap + icon) at the strip's largest type size — brief's "no blank gap at 1920px" bar. */
const MIN_SEQUENCE_CHARS = 1920 / 8;
const SECONDS_PER_NAME = 7;

function buildNameSequence(places: readonly string[]): string[] {
  const distinct = Array.from(new Set([...places, ...FALLBACK_PLACES]));
  const base = distinct.length >= MIN_DISTINCT_NAMES ? distinct : Array.from(new Set([...distinct, ...FALLBACK_PLACES]));

  const totalChars = base.reduce((sum, name) => sum + name.length + 4, 0);
  const repeats = Math.max(1, Math.ceil(MIN_SEQUENCE_CHARS / Math.max(totalChars, 1)));
  return Array.from({ length: repeats }, () => base).flat();
}

export function RouteMarquee({ places }: RouteMarqueeProps) {
  const names = buildNameSequence(places);
  const durationSeconds = names.length * SECONDS_PER_NAME;
  // Two identical sequences back to back so `translateX(-50%)` loops seamlessly.
  const sequences = [names, names];

  return (
    <div className="relative overflow-hidden border-b border-stone-100 bg-white py-4">
      <div
        className="flex w-max animate-redux-marquee"
        style={{ '--marquee-duration': `${durationSeconds}s` } as CSSProperties}
      >
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

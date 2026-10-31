import type { ReactNode } from 'react';

import type { SiteStatsSummary } from '@/lib/site-stats';

export interface StatsBarProps {
  stats: SiteStatsSummary;
}

/**
 * Export lines 330-336, tech spec §4.4 row 11.
 *
 * REDESIGNED (CRM-migration decision 3) to show exactly the 3 figures the
 * CRM's `/public/site` settings expose — `happyTravellers`, `destinations`,
 * `yearsExperience` — instead of the previous 5-item `StatMetric[]` bar.
 * "Group Tours" and "Traveller Satisfaction" are gone for good: there is no
 * CRM field for either, and nowhere left to source them from. `Hero`'s own
 * 3-card strip and `WhyGtyBand`'s inline years-of-service mention are
 * untouched — they still read the wider `getStats()` list, which is a
 * separate, unrelated figure pick from this band.
 *
 * Each figure is rendered VERBATIM (never reformatted/parsed) and is simply
 * omitted — no blank box, no placeholder dash — when its value is absent,
 * which the CRM contract documents as the state of every settings field
 * until the Owner saves one for the first time.
 *
 * The old per-stat `isPlaceholder` asterisk is replaced by a single
 * `showFiguresNote` switch for the whole band, matching `/public/site`'s own
 * `showFiguresNote` setting — one flag, not five independently-tracked ones.
 * `role="group"` + `aria-describedby` on this roled container (rather than a
 * bare `<div>`) is kept from the previous version: that pairing is what
 * actually reaches assistive tech, and `stats-single-source.test.tsx`
 * asserts it here, in `WhyGtyBand` and in `Hero` identically.
 */
const PLACEHOLDER_NOTE_ID = 'stats-placeholder-note';

interface StatCard {
  key: 'happyTravellers' | 'destinations' | 'yearsExperience';
  icon: ReactNode;
  caption: string;
  value: string | undefined;
}

/** Small red underline flourish beneath each stat — decorative, matches the reference image. */
function StatUnderline() {
  return (
    <svg aria-hidden="true" viewBox="0 0 64 10" className="h-[7px] w-12 text-gty-primary/55">
      <path d="M2 6 C14 -1 22 9 32 4 C42 -1 50 9 62 3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

const STAT_ICONS: Record<StatCard['key'], ReactNode> = {
  happyTravellers: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20c0-4 3.1-6.4 7-6.4s7 2.4 7 6.4z" />
    </svg>
  ),
  destinations: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M12 2c3.9 0 7 3.1 7 7 0 5.3-7 13-7 13S5 14.3 5 9c0-3.9 3.1-7 7-7zm0 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
    </svg>
  ),
  yearsExperience: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M12 2 14.6 8.6 22 9.2 16.3 13.8 18.1 21 12 17.2 5.9 21 7.7 13.8 2 9.2 9.4 8.6Z" />
    </svg>
  ),
};

/** Faint red mountain/forest silhouette along the bottom of the card — echoes `Footer`'s own mountain motif, tinted red per the reference image. */
function FiguresMountainBand() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1400 70"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-7 w-full text-gty-primary/18 860:h-9"
    >
      <path d="M0 70 L60 20 L120 46 L190 10 L260 70Z" fill="currentColor" />
      <path d="M1140 70 L1220 14 L1300 44 L1400 6 L1400 70Z" fill="currentColor" />
    </svg>
  );
}

export function StatsBar({ stats }: StatsBarProps) {
  const allCards: StatCard[] = [
    { key: 'happyTravellers', icon: STAT_ICONS.happyTravellers, caption: 'Happy Travellers', value: stats.happyTravellers },
    { key: 'destinations', icon: STAT_ICONS.destinations, caption: 'Destinations', value: stats.destinations },
    { key: 'yearsExperience', icon: STAT_ICONS.yearsExperience, caption: 'Years of Experience', value: stats.yearsExperience },
  ];
  const cards = allCards.filter((card) => card.value !== undefined && card.value !== '');

  if (cards.length === 0) return null;

  return (
    <div data-testid="section-11-stats" className="flex flex-col gap-2 bg-gty-surface-5 px-gx pb-[34px]">
      <div
        role="group"
        aria-label="Guruji Travel Yatra in numbers"
        className="relative flex flex-wrap overflow-hidden rounded-16 shadow-gty-card"
        style={{ background: 'radial-gradient(120% 160% at 50% -20%,#ffffff 0%,#fdf7f6 55%,#fbefed 100%)' }}
        aria-describedby={stats.showFiguresNote ? PLACEHOLDER_NOTE_ID : undefined}
      >
        <FiguresMountainBand />
        {cards.map((card, index) => (
          <div
            key={card.key}
            className={`relative flex min-w-[110px] flex-1 flex-col items-center gap-[9px] px-3 py-[30px] ${index > 0 ? 'border-l border-gty-red-200' : ''}`}
          >
            <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-12 bg-gty-white text-gty-primary shadow-gty-sm">
              {card.icon}
            </span>
            <p className="text-[30px] font-extrabold leading-none text-gty-primary">
              {card.value}
              {stats.showFiguresNote && (
                <span
                  aria-hidden="true"
                  data-testid={`stat-placeholder-marker-${card.key}`}
                  className="align-super text-16 font-bold text-gty-primary/60"
                >
                  *
                </span>
              )}
            </p>
            <p className="text-13-5 text-gty-ink-soft">{card.caption}</p>
            <StatUnderline />
          </div>
        ))}
      </div>

      {stats.showFiguresNote && (
        <p id={PLACEHOLDER_NOTE_ID} data-testid="stats-placeholder-note" className="text-11 text-gty-subtle">
          *These figures are pending confirmation and are shown as placeholders.
        </p>
      )}
    </div>
  );
}

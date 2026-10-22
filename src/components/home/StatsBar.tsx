import type { SiteStatsSummary } from '@/content/types';

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
  icon: string;
  caption: string;
  value: string | undefined;
}

export function StatsBar({ stats }: StatsBarProps) {
  const allCards: StatCard[] = [
    { key: 'happyTravellers', icon: '☺', caption: 'Happy Travellers', value: stats.happyTravellers },
    { key: 'destinations', icon: '◍', caption: 'Destinations', value: stats.destinations },
    { key: 'yearsExperience', icon: '✷', caption: 'Years of Experience', value: stats.yearsExperience },
  ];
  const cards = allCards.filter((card) => card.value !== undefined && card.value !== '');

  if (cards.length === 0) return null;

  return (
    <div data-testid="section-11-stats" className="flex flex-col gap-2 bg-gty-surface-5 px-gx pb-[34px]">
      <div
        role="group"
        aria-label="Guruji Travel Yatra in numbers"
        className="flex flex-wrap overflow-hidden rounded-16 bg-gty-primary shadow-gty-stats"
        aria-describedby={stats.showFiguresNote ? PLACEHOLDER_NOTE_ID : undefined}
      >
        {cards.map((card) => (
          <div key={card.key} className="flex min-w-[110px] flex-1 flex-col items-center gap-[9px] px-3 py-[30px]">
            <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-pill bg-gty-white/16 text-16 text-gty-white">
              {card.icon}
            </span>
            <p className="text-[30px] font-extrabold leading-none text-gty-white">
              {card.value}
              {stats.showFiguresNote && (
                <span
                  aria-hidden="true"
                  data-testid={`stat-placeholder-marker-${card.key}`}
                  className="align-super text-16 font-bold text-gty-white/70"
                >
                  *
                </span>
              )}
            </p>
            <p className="text-13-5 text-gty-white/88">{card.caption}</p>
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

import type { StatMetric } from '@/content/types';

export interface StatsBarProps {
  stats: StatMetric[];
}

/**
 * Export lines 330-336, tech spec §4.4 row 11.
 *
 * Placeholder figures (`isPlaceholder`, see stats.fixture.ts) are marked with
 * an asterisk plus one footnote line, following the same principle as the
 * testimonials: unconfirmed content ships visibly unconfirmed, never styled as
 * settled fact. The treatment is deliberately quieter than `ReviewCard`'s
 * dashed border + "Placeholder" pill — a review card is a whole fabricated
 * story, whereas these are real-looking numbers awaiting confirmation, and the
 * bar is a single solid brand-red band that a dashed border would break.
 * The asterisk is `aria-hidden`; screen readers get the footnote, which is
 * associated with the group via `aria-describedby`.
 *
 * `role="group"` is what makes that association actually reach assistive tech:
 * `aria-describedby` on a bare `<div>` with no role is routinely ignored, so
 * the pairing was correct on paper and silent in practice. The same three
 * pieces — a real `id`, a real `aria-describedby` on a roled container, and a
 * visible asterisk — now appear identically here, in `WhyGtyBand` and in
 * `Hero`, and `stats-single-source.test.tsx` asserts the pairing on all three.
 */
const PLACEHOLDER_NOTE_ID = 'stats-placeholder-note';

export function StatsBar({ stats }: StatsBarProps) {
  const hasPlaceholder = stats.some((stat) => stat.isPlaceholder);

  return (
    <div data-testid="section-11-stats" className="flex flex-col gap-2 bg-gty-surface-5 px-gx pb-[34px]">
      <div
        role="group"
        aria-label="Guruji Travel Yatra in numbers"
        className="flex flex-wrap overflow-hidden rounded-16 bg-gty-primary shadow-gty-stats"
        aria-describedby={hasPlaceholder ? PLACEHOLDER_NOTE_ID : undefined}
      >
        {stats.map((stat) => (
          <div key={stat.label} className="flex min-w-[110px] flex-1 flex-col items-center gap-[9px] px-3 py-[30px]">
            <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-pill bg-gty-white/16 text-16 text-gty-white">
              {stat.icon}
            </span>
            <p className="text-[30px] font-extrabold leading-none text-gty-white">
              {stat.value}
              {stat.isPlaceholder && (
                <span
                  aria-hidden="true"
                  data-testid={`stat-placeholder-marker-${stat.label}`}
                  className="align-super text-16 font-bold text-gty-white/70"
                >
                  *
                </span>
              )}
            </p>
            <p className="text-13-5 text-gty-white/88">{stat.label}</p>
          </div>
        ))}
      </div>

      {hasPlaceholder && (
        <p id={PLACEHOLDER_NOTE_ID} data-testid="stats-placeholder-note" className="text-11 text-gty-subtle">
          *These figures are pending confirmation and are shown as placeholders.
        </p>
      )}
    </div>
  );
}

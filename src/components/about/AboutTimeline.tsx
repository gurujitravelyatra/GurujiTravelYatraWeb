import type { AboutMilestone } from '@/content/types';

export interface AboutTimelineProps {
  milestones: AboutMilestone[];
}

/**
 * Mirrors `StatsBar`'s / `WhyGtyBand`'s `-placeholder-note` pairing exactly:
 * a real `id` on the footnote and a real `aria-describedby` on the roled
 * group holding the marked figures, so the association actually reaches
 * assistive tech (a bare `aria-describedby` on an unroled `<div>` is
 * routinely ignored).
 */
const PLACEHOLDER_NOTE_ID = 'about-timeline-placeholder-note';

/**
 * "Our Journey" timeline — design export lines 730-734, product-spec §5.8.
 *
 * Every milestone in `aboutMilestones` (about.fixture.ts) is `isPlaceholder`:
 * they quote the same contested traveller/destination counts `StatsBar`
 * already marks (Assumption A3), plus unconfirmed company-history claims —
 * a founding year and first-yatra date nobody at GTY has confirmed. Marked
 * here with the same asterisk + footnote treatment as `StatsBar` /
 * `WhyGtyBand`, never presented as settled fact.
 */
export function AboutTimeline({ milestones }: AboutTimelineProps) {
  const hasPlaceholder = milestones.some((milestone) => milestone.isPlaceholder);

  return (
    <section
      data-testid="section-about-timeline"
      className="flex flex-col gap-[14px] border-t border-gty-border-6 px-gx py-[22px]"
    >
      <p className="text-10 font-bold uppercase tracking-label text-gty-subtle">Our Journey</p>

      <div
        role="group"
        aria-label="GTY's journey so far"
        aria-describedby={hasPlaceholder ? PLACEHOLDER_NOTE_ID : undefined}
        className="flex flex-wrap"
      >
        {milestones.map((milestone) => (
          <div key={milestone.year} className="flex min-w-[140px] flex-1 flex-col gap-[7px] pr-4">
            <span aria-hidden="true" className="h-[2px] bg-gty-primary" />
            <p className="text-12 font-bold text-gty-ink">
              {milestone.year}
              {milestone.isPlaceholder && (
                <span
                  aria-hidden="true"
                  data-testid={`about-timeline-placeholder-marker-${milestone.year}`}
                  className="align-super text-11 font-bold text-gty-subtle"
                >
                  *
                </span>
              )}
            </p>
            <p className="text-11-5 leading-[1.4] text-gty-subtle">{milestone.description}</p>
          </div>
        ))}
      </div>

      {hasPlaceholder && (
        <p id={PLACEHOLDER_NOTE_ID} data-testid="about-timeline-placeholder-note" className="text-11 text-gty-subtle">
          *These milestones are pending confirmation and are shown as placeholders.
        </p>
      )}
    </section>
  );
}

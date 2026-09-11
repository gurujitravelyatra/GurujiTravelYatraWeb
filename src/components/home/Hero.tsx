import type { StatMetric } from '@/content/types';
import { PhotoPlaceholder } from '@/components/ui/photo-placeholder';
import { HeroCtas } from './HeroCtas';

/**
 * Export lines 160-176, tech spec §4.4 row 2.
 *
 * BLOCKERS.md §4 ("Accessibility / correctness items"): the hero photo is
 * DETERMINISTIC — a single fixed fixture key, never rotated/randomized. No
 * `Math.random()`, no `Date`-derived index, so there is no hydration
 * mismatch and the hero stays stable for SEO. Picked from the export's own
 * 6-key set (hero/Himalayas/Varanasi/Kashmir_Valley/Leh/Rishikesh).
 */
const HERO_PHOTO_KEY = 'Himalayas';

/**
 * Which of the canonical stats the hero strip surfaces, by label, in order.
 *
 * The hero used to hold its OWN `HERO_STATS` literal ("10,000+", "150+",
 * "8+ Years") while `StatsBar` — on the same page — rendered
 * `contentAdapter.getStats()`. Two sources of truth for one set of numbers,
 * guaranteed to drift the first time someone edited one of them. The hero now
 * SELECTS from the same array; it never restates a figure.
 */
const HERO_STAT_LABELS = ['Happy Travellers', 'Destinations', 'Years of Experience'] as const;

/**
 * Mirrors `StatsBar`'s `stats-placeholder-note` pairing exactly: a real `id`
 * on the footnote and a real `aria-describedby` on the roled group that holds
 * the marked figures.
 *
 * The hero previously had NEITHER, so its asterisk was a bare glyph pointing
 * at nothing: sighted visitors got a 9px white footnote sitting directly on a
 * photograph (illegible at any realistic contrast), and screen-reader users
 * got no association at all. The note is now drawn with the same white card +
 * `text-gty-subtle` treatment as the stat chips beside it — the only other
 * overlay elements in this corner — rather than a bespoke one-off.
 */
const PLACEHOLDER_NOTE_ID = 'hero-stats-placeholder-note';

export interface HeroProps {
  /** The same `getStats()` result the `StatsBar` renders — passed from the page. */
  stats: StatMetric[];
}

/**
 * Picks the hero's three figures out of the canonical list. Missing labels are
 * skipped rather than substituted, and if none of the preferred labels exist
 * the hero falls back to the first three stats — it never invents a number and
 * never renders an empty card.
 */
function selectHeroStats(stats: StatMetric[]): StatMetric[] {
  const preferred = HERO_STAT_LABELS.map((label) => stats.find((stat) => stat.label === label)).filter(
    (stat): stat is StatMetric => stat !== undefined
  );
  return preferred.length > 0 ? preferred : stats.slice(0, 3);
}

export function Hero({ stats }: HeroProps) {
  const heroStats = selectHeroStats(stats);
  const hasPlaceholder = heroStats.some((stat) => stat.isPlaceholder);

  return (
    <section data-testid="section-2-hero" className="relative flex min-h-[420px] items-start overflow-hidden bg-gty-img-bg 760:min-h-[620px]">
      <PhotoPlaceholder
        photoKey={HERO_PHOTO_KEY}
        alt="Himalayan landscape — Guruji Travel Yatra"
        className="absolute inset-0 h-full w-full items-end justify-end p-4 text-right"
      />
      <span
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(98deg,rgba(0,0,0,.28) 0%,rgba(0,0,0,.16) 32%,rgba(0,0,0,.05) 55%,rgba(0,0,0,0) 72%)',
        }}
      />

      <div className="relative z-[2] flex max-w-[680px] flex-col gap-6 px-gx pb-8 pt-9 760:pb-[190px] 760:pt-14">
        <p
          className="text-11 font-bold uppercase tracking-eyebrow-3 text-gty-primary"
          style={{ textShadow: '0 2px 8px rgba(255,255,255,.55)' }}
        >
          Journeys that stay forever
        </p>
        <h1
          className="text-36 font-extrabold leading-[1.05] tracking-tightest text-gty-ink 760:text-62 760:leading-[1.02]"
          style={{ textShadow: '0 3px 16px rgba(255,255,255,.55)' }}
        >
          Not All Those
          <br className="hidden 760:block" /> Who Wander
          <br className="hidden 760:block" /> <span className="font-script text-[44px] text-gty-primary 760:text-76">Are Lost</span>
        </h1>
        <p
          className="max-w-[440px] text-14 leading-[1.7] text-gty-white 760:text-15"
          style={{ textShadow: '0 2px 10px rgba(255,255,255,.5)' }}
        >
          From sacred pilgrimages to breathtaking getaways, we create experiences that touch your soul and memories
          that last a lifetime.
        </p>
        <HeroCtas />
      </div>

      <div
        data-testid="hero-stats"
        role="group"
        aria-label="Guruji Travel Yatra in numbers"
        aria-describedby={hasPlaceholder ? PLACEHOLDER_NOTE_ID : undefined}
        className="static flex flex-wrap items-start gap-2 px-gx pb-7 760:absolute 760:bottom-20 760:left-gx 760:z-[2] 760:flex-nowrap 760:px-0 760:pb-0"
      >
        {heroStats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-16 border border-gty-border bg-gty-white px-[18px] py-[14px] shadow-gty-lift"
          >
            <div className="text-20 font-extrabold tracking-tightest text-gty-ink">
              {stat.value}
              {stat.isPlaceholder && (
                <span
                  aria-hidden="true"
                  data-testid={`hero-stat-placeholder-${stat.label}`}
                  className="align-super text-11 text-gty-subtle"
                >
                  *
                </span>
              )}
            </div>
            <div className="text-11 text-gty-subtle">{stat.label}</div>
          </div>
        ))}
        {hasPlaceholder && (
          <p
            id={PLACEHOLDER_NOTE_ID}
            data-testid="hero-stats-placeholder-note"
            className="self-center rounded-pill border border-gty-border bg-gty-white px-3 py-[6px] text-11 text-gty-subtle shadow-gty-lift 760:self-end"
          >
            *Figures pending confirmation
          </p>
        )}
      </div>
    </section>
  );
}

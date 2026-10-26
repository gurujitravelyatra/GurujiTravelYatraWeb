import type { SiteStatsSummary } from '@/lib/site-stats';
import { PhotoPlaceholder } from '@/components/ui/photo-placeholder';
import { HeroCtas } from './HeroCtas';

/**
 * Mirrors `StatsBar`'s `stats-placeholder-note` id scheme — the same
 * single-flag note, not a per-stat marker (CRM-migration decision 1/3
 * retired the per-figure placeholder system).
 */
const PLACEHOLDER_NOTE_ID = 'hero-stats-placeholder-note';

export interface HeroProps {
  /** `site.settings.heroHeadline`/`heroSubtext` from `GET /public/site` — `null` until the Owner sets them. */
  headline: string | null;
  subtext: string | null;
  /** `site.images.HERO_BACKGROUND[0]`, if the CRM has one configured. */
  heroImageUrl?: string;
  /** The SAME `SiteStatsSummary` `StatsBar` renders, further down the page — one source, never two. */
  stats: SiteStatsSummary;
}

const DEFAULT_HEADLINE = (
  <>
    Not All Those
    <br className="hidden 760:block" /> Who Wander
    <br className="hidden 760:block" /> <span className="font-script text-[44px] text-gty-primary 760:text-76">Are Lost</span>
  </>
);
const DEFAULT_SUBTEXT =
  'From sacred pilgrimages to breathtaking getaways, we create experiences that touch your soul and memories that last a lifetime.';

interface StatCard {
  key: string;
  label: string;
  value: string;
}

export function Hero({ headline, subtext, heroImageUrl, stats }: HeroProps) {
  const cards: StatCard[] = [
    { key: 'happyTravellers', label: 'Happy Travellers', value: stats.happyTravellers ?? '' },
    { key: 'destinations', label: 'Destinations', value: stats.destinations ?? '' },
    { key: 'yearsExperience', label: 'Years of Experience', value: stats.yearsExperience ?? '' },
  ].filter((card) => card.value !== '');

  return (
    <section data-testid="section-2-hero" className="relative flex min-h-[420px] items-start overflow-hidden bg-gty-img-bg 760:min-h-[620px]">
      <PhotoPlaceholder
        photoKey="Himalayas"
        imageUrl={heroImageUrl}
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
          {headline ?? DEFAULT_HEADLINE}
        </h1>
        <p
          className="max-w-[440px] text-14 leading-[1.7] text-gty-white 760:text-15"
          style={{ textShadow: '0 2px 10px rgba(255,255,255,.5)' }}
        >
          {subtext ?? DEFAULT_SUBTEXT}
        </p>
        <HeroCtas />
      </div>

      {cards.length > 0 && (
        <div
          data-testid="hero-stats"
          role="group"
          aria-label="Guruji Travel Yatra in numbers"
          aria-describedby={stats.showFiguresNote ? PLACEHOLDER_NOTE_ID : undefined}
          className="static flex flex-wrap items-start gap-2 px-gx pb-7 760:absolute 760:bottom-20 760:left-gx 760:z-[2] 760:flex-nowrap 760:px-0 760:pb-0"
        >
          {cards.map((card) => (
            <div
              key={card.key}
              className="rounded-16 border border-gty-border bg-gty-white px-[18px] py-[14px] shadow-gty-lift"
            >
              <div className="text-20 font-extrabold tracking-tightest text-gty-ink">
                {card.value}
                {stats.showFiguresNote && (
                  <span
                    aria-hidden="true"
                    data-testid={`hero-stat-placeholder-${card.key}`}
                    className="align-super text-11 text-gty-subtle"
                  >
                    *
                  </span>
                )}
              </div>
              <div className="text-11 text-gty-subtle">{card.label}</div>
            </div>
          ))}
          {stats.showFiguresNote && (
            <p
              id={PLACEHOLDER_NOTE_ID}
              data-testid="hero-stats-placeholder-note"
              className="self-center rounded-pill border border-gty-border bg-gty-white px-3 py-[6px] text-11 text-gty-subtle shadow-gty-lift 760:self-end"
            >
              *Figures pending confirmation
            </p>
          )}
        </div>
      )}
    </section>
  );
}

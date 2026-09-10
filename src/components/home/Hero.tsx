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

const HERO_STATS = [
  { value: '10,000+', label: 'Happy Travellers' },
  { value: '150+', label: 'Destinations' },
  { value: '8+ Years', label: 'Of Trust & Service' },
] as const;

export function Hero() {
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

      <div className="static flex flex-wrap gap-2 px-gx pb-7 760:absolute 760:bottom-20 760:left-gx 760:z-[2] 760:flex-nowrap 760:px-0 760:pb-0">
        {HERO_STATS.map((stat) => (
          <div
            key={stat.label}
            className="rounded-16 border border-gty-border bg-gty-white px-[18px] py-[14px] shadow-gty-lift"
          >
            <div className="text-20 font-extrabold tracking-tightest text-gty-ink">{stat.value}</div>
            <div className="text-11 text-gty-subtle">{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

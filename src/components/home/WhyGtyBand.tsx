'use client';

import { type ReactNode, useRef } from 'react';
import { useInView } from 'framer-motion';
import { Award, Headset, MapPin, ShieldCheck, Soup, Users } from 'lucide-react';

import type { SiteStatsSummary } from '@/lib/site-stats';
import { CountUpStat } from './CountUpStat';
import { Reveal } from './Reveal';

/**
 * Mirrors `StatsBar`'s own id scheme — the single `showFiguresNote` flag
 * gates one footnote for the whole stats band, same pattern, independent id
 * (`StatsBar` is unchanged and still used by `/about-us`, out of scope this
 * round — see this file's own header for why the stats band is duplicated
 * here rather than shared).
 */
const PLACEHOLDER_NOTE_ID = 'why-gty-stats-placeholder-note';

export interface WhyGtyBandProps {
  /** The SAME `SiteStatsSummary` `Hero` renders — one source, never two independently-maintained copies of a figure. */
  stats: SiteStatsSummary;
}

/**
 * Export lines 259-313, tech spec §4.4 (unnumbered row, "Why Travel With
 * GTY?" band). This is where product-spec §5.1 step 4's "Trust strip"
 * content actually renders.
 *
 * "Redux" redesign (brief §8, 2026-11-14) — full replacement of the
 * illustrated-icon design from the previous (2026-11-04) round with the
 * reference's icon-circle pillar grid + an integrated stats band.
 *
 * The stats band ITSELF is a deliberate near-duplicate of `StatsBar`'s
 * hide-logic (per-stat, whole-band, `showFiguresNote`), not a reuse of that
 * component: `StatsBar` is also rendered on `/about-us`, which is out of
 * scope for this round's redesign ("restyle the existing home page (and
 * the shared header/footer)" — not every page), so changing `StatsBar`
 * itself would have restyled that page too. Both read the exact same
 * `SiteStatsSummary` shape from the exact same CRM field — "single source"
 * means the DATA is shared, not that every visual presentation of it must
 * share one component.
 */
const PILLAR_ICONS: readonly ReactNode[] = [
  <MapPin key="curated-yatras" size={22} aria-hidden="true" />,
  <Award key="trusted-since" size={22} aria-hidden="true" />,
  <Headset key="travel-support" size={22} aria-hidden="true" />,
  <Soup key="pure-veg" size={22} aria-hidden="true" />,
  <ShieldCheck key="safe-comfortable" size={22} aria-hidden="true" />,
];

const TRUST_DESCRIPTION = 'Group yatras and family journeys across India and beyond';

/**
 * CRM-migration Step 2: "Trusted Since X Years" reads `yearsExperience`
 * straight from the CRM (the same field the stats band below reads) instead
 * of guessing a number. A value the CRM Owner actually typed needs no
 * asterisk. `undefined` (not yet set) omits the number rather than
 * inventing one — matching the brief's own fallback framing ("Trusted For
 * Years") for exactly that case.
 */
function buildPillars(yearsExperience: string | undefined) {
  return [
    { title: 'Curated Yatras', description: 'Handpicked spiritual journeys & destinations' },
    {
      title: yearsExperience ? `Trusted Since ${yearsExperience} Years` : 'Trusted For Years',
      description: TRUST_DESCRIPTION,
    },
    { title: '24/7 Travel Support', description: "We're with you at every step of your journey" },
    { title: 'Pure Veg Meals', description: 'Hygienic & delicious food on all tours' },
    { title: 'Safe & Comfortable', description: 'Well-planned trips with safety & comfort' },
  ];
}

/** Faint mountain silhouette along the stats band's bottom edge — matches the brief's own SVG. */
function StatsMountainBand() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1200 120"
      preserveAspectRatio="none"
      className="pointer-events-none absolute -bottom-2 left-0 w-full text-white/10"
    >
      <path d="M0 120L180 40l160 60 200-80 220 70 240-60 200 50v40H0z" fill="currentColor" />
    </svg>
  );
}

const STATS_ICONS: Record<'happyTravellers' | 'destinations' | 'yearsExperience', ReactNode> = {
  happyTravellers: <Users size={20} aria-hidden="true" />,
  destinations: <MapPin size={20} aria-hidden="true" />,
  yearsExperience: <Award size={20} aria-hidden="true" />,
};

interface StatEntry {
  key: 'happyTravellers' | 'destinations' | 'yearsExperience';
  icon: ReactNode;
  label: string;
  value: string | undefined;
}

export function WhyGtyBand({ stats }: WhyGtyBandProps) {
  const pillars = buildPillars(stats.yearsExperience);
  const statsRef = useRef<HTMLDivElement>(null);
  // Brief §A7 (2026-11-14): the same 0-to-X count-up as the hero's stats
  // band, triggered once this band itself (not the pillars above it)
  // scrolls 50% into view.
  const statsInView = useInView(statsRef, { once: true, amount: 0.5 });

  const allStats: StatEntry[] = [
    { key: 'happyTravellers', icon: STATS_ICONS.happyTravellers, label: 'Happy Travellers', value: stats.happyTravellers },
    { key: 'destinations', icon: STATS_ICONS.destinations, label: 'Destinations', value: stats.destinations },
    { key: 'yearsExperience', icon: STATS_ICONS.yearsExperience, label: 'Years of Experience', value: stats.yearsExperience },
  ];
  const statCards = allStats.filter((stat) => stat.value !== undefined && stat.value !== '');

  return (
    <section data-testid="section-why-gty-trust-strip" className="bg-white px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <Reveal className="text-center">
        <span className="inline-flex items-center gap-3 text-xs font-bold uppercase tracking-widest2 text-redux-crimson sm:text-sm">
          <span aria-hidden="true" className="h-px w-8 border-t-2 border-dashed border-redux-crimson/50" />
          The GTY Promise
          <span aria-hidden="true" className="h-px w-8 border-t-2 border-dashed border-redux-crimson/50" />
        </span>
        <h2 className="mt-4 font-redux-display text-4xl font-medium tracking-tight text-stone-900 sm:text-5xl">
          Why Travel With <em className="italic text-redux-crimson">GTY?</em>
        </h2>
      </Reveal>

      <div className="mx-auto mt-12 grid max-w-[1320px] gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {pillars.map((pillar, index) => (
          <Reveal key={pillar.title} delay={Math.min(index * 0.08, 0.32)} className={index === 4 ? 'col-span-2 h-full sm:col-span-1' : 'h-full'}>
            <div className="group h-full rounded-3xl border border-stone-200/80 bg-redux-cream/60 p-6 text-center transition-all duration-400 hover:-translate-y-1.5 hover:border-redux-crimson/40 hover:bg-white hover:shadow-[0_25px_50px_-25px_rgba(127,18,22,0.35)]">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-redux-crimson-tint text-redux-crimson ring-1 ring-redux-crimson/15 transition-all duration-400 group-hover:bg-redux-crimson group-hover:text-white group-hover:ring-redux-crimson">
                {PILLAR_ICONS[index]}
              </span>
              <p className="mt-5 text-[15px] font-extrabold text-stone-900">{pillar.title}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-redux-ink-mute">{pillar.description}</p>
            </div>
          </Reveal>
        ))}
      </div>

      {statCards.length > 0 && (
        <Reveal delay={0.1} className="mx-auto mt-12 max-w-[1320px]">
          <div
            ref={statsRef}
            role="group"
            aria-label="Guruji Travel Yatra in numbers"
            aria-describedby={stats.showFiguresNote ? PLACEHOLDER_NOTE_ID : undefined}
            className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-redux-crimson-deep via-redux-crimson-dark to-redux-crimson px-7 py-10 sm:px-12"
          >
            <StatsMountainBand />
            <div className="relative grid gap-8 sm:grid-cols-3">
              {statCards.map((stat, index) => (
                <div key={stat.key} className="flex items-center gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15 text-white">{stat.icon}</span>
                  <div>
                    <p className="font-redux-display text-3xl font-semibold leading-none text-white sm:text-4xl">
                      <CountUpStat value={stat.value as string} stagger={index * 0.12} start={statsInView} suffixClassName="text-red-200" />
                      {stats.showFiguresNote && (
                        <span
                          aria-hidden="true"
                          data-testid={`why-gty-stat-placeholder-${stat.key}`}
                          className="align-super text-base text-red-200"
                        >
                          *
                        </span>
                      )}
                    </p>
                    <p className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {stats.showFiguresNote && (
            <p id={PLACEHOLDER_NOTE_ID} data-testid="why-gty-stats-placeholder-note" className="mt-3 text-center text-xs text-redux-ink-mute">
              *These figures are pending confirmation and are shown as placeholders.
            </p>
          )}
        </Reveal>
      )}
    </section>
  );
}

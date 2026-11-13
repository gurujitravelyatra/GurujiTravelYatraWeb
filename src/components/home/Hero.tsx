'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

import type { SiteStatsSummary } from '@/lib/site-stats';
import { PhotoPlaceholder } from '@/components/ui/photo-placeholder';
import { HeroCtas } from './HeroCtas';

const EASE = [0.22, 1, 0.36, 1] as const;

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

/**
 * "Redux" redesign (brief §3, 2026-11-14) default headline — replaces the
 * old fallback ("Not All Those Who Wander Are Lost") with the reference's
 * own copy, split into the two lines its masked-reveal animation expects.
 * A real CRM headline (`headline` prop) still wins when the Owner has set
 * one — this is only what renders before that ever happens.
 */
const DEFAULT_HEADLINE_LINES = ['Journeys That', 'Stay Forever.'];
const DEFAULT_SUBTEXT =
  'From sacred pilgrimages to breathtaking getaways, we create experiences that touch your soul and memories that last a lifetime.';

interface StatCard {
  key: string;
  label: string;
  value: string;
}

/**
 * Splits a CRM headline into masked-reveal lines. The reference's own
 * choreography is for exactly 2 fixed lines of its own hardcoded copy — a
 * real CRM-typed headline has no guaranteed line count, so this renders
 * whatever the Owner typed as its own line(s) (split only on an explicit
 * newline, never invented) rather than forcing it into a 2-line shape it
 * may not fit. The LAST line's trailing word is never auto-italicised for
 * a real headline — that treatment is specific to the reference's own
 * fallback copy ("Stay <em>Forever.</em>"), not something to impose on
 * text the Owner wrote.
 */
function headlineLines(headline: string | null): { text: string; italicTail?: string }[] {
  if (!headline) {
    return [{ text: DEFAULT_HEADLINE_LINES[0] }, { text: 'Stay ', italicTail: 'Forever.' }];
  }
  return headline.split('\n').map((text) => ({ text }));
}

function MaskedLine({ line, delay }: { line: { text: string; italicTail?: string }; delay: number }) {
  return (
    <span className="block overflow-hidden pb-1">
      <motion.span
        className="block"
        initial={{ y: '112%' }}
        animate={{ y: 0 }}
        transition={{ duration: 1, delay, ease: EASE }}
      >
        {line.text}
        {line.italicTail && <em className="italic text-redux-crimson">{line.italicTail}</em>}
      </motion.span>
    </span>
  );
}

export function Hero({ headline, subtext, heroImageUrl, stats }: HeroProps) {
  const { scrollY } = useScroll();
  const parallaxY = useTransform(scrollY, [0, 900], [0, 110]);

  const cards: StatCard[] = [
    { key: 'happyTravellers', label: 'Happy Travellers', value: stats.happyTravellers ?? '' },
    { key: 'destinations', label: 'Destinations', value: stats.destinations ?? '' },
    { key: 'yearsExperience', label: 'Years of Experience', value: stats.yearsExperience ?? '' },
  ].filter((card) => card.value !== '');

  const lines = headlineLines(headline);

  return (
    <section
      data-testid="section-2-hero"
      className="relative isolate flex min-h-screen flex-col justify-end overflow-hidden bg-stone-950"
    >
      <motion.div style={{ y: parallaxY }} className="absolute inset-0 -z-10">
        <PhotoPlaceholder
          photoKey="Himalayas"
          imageUrl={heroImageUrl}
          alt="Himalayan landscape — Guruji Travel Yatra"
          className="h-[115%] w-full"
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-stone-950/70 via-stone-950/30 to-stone-950/80"
        />
        <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-stone-950/55 via-transparent to-transparent" />
      </motion.div>

      {/*
        Owner fix 2: the reference's decorative outline word read "YATRI"
        (a typo) and ran off the right edge of the viewport at 1280-1920px
        (`right-0` with a fixed `text-[13rem]`). Fixed to "YATRA", moved in
        from the edge (`right-6 lg:right-10`), and sized with `clamp()`
        instead of a fixed size so it stays inside the viewport across
        1280/1440/1920px rather than only looking right at one width.
      */}
      <p
        aria-hidden="true"
        className="pointer-events-none absolute -top-6 right-6 hidden select-none font-redux-display text-[clamp(6.5rem,11vw,13rem)] font-bold leading-none tracking-tight text-transparent lg:block lg:right-10"
        style={{ WebkitTextStroke: '2px rgba(220,38,38,0.22)' }}
      >
        YATRA
      </p>

      <div className="relative mx-auto w-full max-w-[1320px] px-4 pb-24 pt-44 sm:px-10 sm:pb-28">
        <motion.span
          initial={{ width: 0 }}
          animate={{ width: 44 }}
          transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
          className="mb-6 block h-[3px] bg-redux-crimson"
        />
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
          className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] font-bold uppercase tracking-[0.3em] text-white sm:text-sm"
        >
          Sacred Yatras
          <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rotate-45 bg-redux-crimson" />
          Group Tours
          <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rotate-45 bg-redux-crimson" />
          Custom Trips
        </motion.p>
        <h1 className="font-redux-display text-[clamp(3.25rem,8vw,7.25rem)] font-medium leading-[1.04] tracking-tight text-white">
          {lines.map((line, index) => (
            <MaskedLine key={index} line={line} delay={0.3 + index * 0.15} />
          ))}
        </h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.65, ease: EASE }}
          className="mt-6 max-w-xl font-redux-sans text-base leading-relaxed text-white/80 sm:text-lg"
        >
          {subtext ?? DEFAULT_SUBTEXT}
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.8, ease: EASE }}
        >
          <HeroCtas />
        </motion.div>

        {cards.length > 0 && (
          <motion.div
            // `opacity` deliberately left out of this animation (`y` only):
            // framer-motion's mount animation never actually runs in jsdom
            // (no real rAF), so the component stays frozen at its `initial`
            // values whenever a unit test renders it — an `opacity: 0`
            // `initial` would therefore make this content permanently
            // invisible to `toBeVisible()` assertions (see
            // stats-single-source.test.tsx's placeholder-marker check),
            // not just briefly hidden until the animation runs.
            initial={{ y: 24 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.8, delay: 0.9, ease: EASE }}
            data-testid="hero-stats"
            role="group"
            aria-label="Guruji Travel Yatra in numbers"
            aria-describedby={stats.showFiguresNote ? PLACEHOLDER_NOTE_ID : undefined}
            className="mt-14 grid max-w-xl grid-cols-3 divide-x divide-white/15 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl"
          >
            {cards.map((card) => (
              <div key={card.key} className="px-5 py-5 sm:px-8 sm:py-6">
                {/*
                  Brief §3 point 6 wants this to count up from 0 via
                  framer-motion's animate(). Deliberately NOT done: `card.value`
                  is an opaque, CRM-owner-typed string ("10,000+", "8+", or
                  anything else they chose to type), and StatsBar's own header
                  documents "rendered VERBATIM (never reformatted/parsed)" as a
                  load-bearing contract — parsing out a leading number to
                  animate, then re-appending whatever text followed it, would
                  break that for any value that is not cleanly "<number><suffix>".
                  Visual redesign only; the value itself stays a static string.
                */}
                <p className="font-redux-display text-3xl font-semibold leading-none text-white sm:text-4xl">
                  {card.value}
                  {stats.showFiguresNote && (
                    <span
                      aria-hidden="true"
                      data-testid={`hero-stat-placeholder-${card.key}`}
                      className="align-super text-base text-white/60"
                    >
                      *
                    </span>
                  )}
                </p>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.22em] text-white/70 sm:text-[11px]">
                  {card.label}
                </p>
              </div>
            ))}
          </motion.div>
        )}
        {stats.showFiguresNote && cards.length > 0 && (
          <p
            id={PLACEHOLDER_NOTE_ID}
            data-testid="hero-stats-placeholder-note"
            className="mt-3 max-w-xl text-xs text-white/60"
          >
            *Figures pending confirmation
          </p>
        )}
      </div>

      <motion.div
        aria-hidden="true"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 text-white/80"
      >
        <ChevronDown size={20} />
      </motion.div>
    </section>
  );
}

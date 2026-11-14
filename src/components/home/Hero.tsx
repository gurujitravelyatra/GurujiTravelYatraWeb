'use client';

import { useRef } from 'react';
import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

import type { SiteStatsSummary } from '@/lib/site-stats';
import { PhotoPlaceholder } from '@/components/ui/photo-placeholder';
import { CountUpStat } from './CountUpStat';
import { HeroCtas } from './HeroCtas';

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Mirrors `StatsBar`'s `stats-placeholder-note` id scheme — the same
 * single-flag note, not a per-stat marker (CRM-migration decision 1/3
 * retired the per-figure placeholder system).
 */
const PLACEHOLDER_NOTE_ID = 'hero-stats-placeholder-note';

export interface HeroProps {
  /** `site.settings.heroHeadline` from `GET /public/site` — `null` until the Owner sets it. */
  headline: string | null;
  /**
   * Accepted for backward compatibility with `page.tsx`'s existing plumbing
   * but no longer rendered — brief §A4 (2026-11-14) made the subtext a fixed
   * line, deliberately not CRM-sourced, overriding the earlier decision (see
   * `DEFAULT_SUBTEXT`'s own comment below for why).
   */
  subtext: string | null;
  /** `site.images.HERO_BACKGROUND[0]`, if the CRM has one configured. */
  heroImageUrl?: string;
  /** The SAME `SiteStatsSummary` `StatsBar` renders, further down the page — one source, never two. */
  stats: SiteStatsSummary;
}

/**
 * "Redux" redesign (brief §3, 2026-11-14) default headline — replaces the
 * old fallback ("Not All Those Who Wander Are Lost") with the reference's
 * own copy. A real CRM headline (`headline` prop) still wins when the Owner
 * has set one — this is only what renders before that ever happens.
 */
const DEFAULT_HEADLINE = 'Journeys That Stay Forever.';

/**
 * Brief §A4 (2026-11-14): the Owner asked for this line FIXED, not CRM-
 * sourced — reversing the earlier CRM-migration decision that let
 * `site.settings.heroSubtext` override it. This prompt explicitly wins over
 * that earlier choice ("where this prompt and that file differ, this
 * prompt wins"), so the `subtext` prop is accepted (callers still pass it)
 * but intentionally never read below.
 */
const DEFAULT_SUBTEXT =
  'From sacred pilgrimages to breathtaking getaways, we create experiences that touch your soul and memories that last a lifetime.';

interface StatCard {
  key: string;
  label: string;
  value: string;
}

/**
 * Splits a headline into exactly 2 masked-reveal lines, the LAST word of
 * the LAST line always the red-italic accent (brief §A3, 2026-11-14) — this
 * now applies to a real CRM headline too, not only the fallback copy,
 * reversing the earlier "never impose this on Owner-typed text" decision
 * now that the brief asks for it explicitly on every headline.
 *
 * An explicit newline in the CRM text is honoured as the line break; with
 * none, the words split in half (`ceil(n/2)` on line 1, brief's own rule).
 * A single-word headline still gets 2 lines (an empty first line) rather
 * than crashing on "nothing left to accent on its own line" — not a case
 * the CRM can currently produce (every seeded headline is multi-word), but
 * cheap to not crash on.
 */
function headlineLines(headline: string | null): { text: string; italicTail?: string }[] {
  const source = headline ?? DEFAULT_HEADLINE;
  const explicitLines = source.split('\n').filter((line) => line.trim().length > 0);

  const [line1Words, line2Words] =
    explicitLines.length >= 2
      ? [explicitLines[0].trim().split(/\s+/), explicitLines.slice(1).join(' ').trim().split(/\s+/)]
      : splitWordsInHalf(source.trim().split(/\s+/));

  const lastWordIndex = line2Words.length > 0 ? line2Words.length - 1 : -1;
  // Trailing space on line 1 so the accessible/text-content join across the
  // two separately-wrapped block lines reads "...CRM Headline", not
  // "...CRMHeadline" — the visual line break comes from `MaskedLine`'s own
  // `block` wrapper regardless, so this space is never visibly rendered.
  const line1 = line1Words.length > 0 ? `${line1Words.join(' ')} ` : '';
  const line2Lead = lastWordIndex >= 0 ? line2Words.slice(0, lastWordIndex).join(' ') : '';
  const line2Tail = lastWordIndex >= 0 ? line2Words[lastWordIndex] : '';

  return [
    { text: line1 },
    { text: line2Lead.length > 0 ? `${line2Lead} ` : '', italicTail: line2Tail },
  ];
}

/** `ceil(n/2)` words on line 1, the rest on line 2 (brief §A3's own split rule). */
function splitWordsInHalf(words: string[]): [string[], string[]] {
  const splitAt = Math.ceil(words.length / 2);
  return [words.slice(0, splitAt), words.slice(splitAt)];
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

/**
 * Brief §A1 (2026-11-14): the Owner's real CRM `hero` image slot is empty
 * right now (confirmed — `getSite()` returns `images.HERO_BACKGROUND: []`
 * until the Owner uploads one), so `heroImageUrl` arrives `undefined` and
 * this fell through to `PhotoPlaceholder`'s grey placeholder box instead of
 * a photo. This is the Owner's own confirmed file, already on the trusted
 * media host (`FALLBACK_MEDIA_HOST` in `src/lib/media-host.ts`) — used only
 * when the CRM slot is empty or its URL fails `safeMediaUrl()`; a real CRM
 * upload still wins the moment one exists.
 */
const FALLBACK_HERO_IMAGE_URL = 'https://media.gurujitravelyatra.com/site-images/51507ac4-baf9-4d38-9e0a-c4bdda789679.webp';

export function Hero({ headline, heroImageUrl, stats }: HeroProps) {
  const { scrollY } = useScroll();
  const parallaxY = useTransform(scrollY, [0, 900], [0, 110]);
  const statsRef = useRef<HTMLDivElement>(null);
  const statsInView = useInView(statsRef, { once: true, amount: 0.5 });

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
          imageUrl={heroImageUrl ?? FALLBACK_HERO_IMAGE_URL}
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
          {DEFAULT_SUBTEXT}
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
            ref={statsRef}
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
            // Brief §A6 (2026-11-14): full content width, not a narrow `max-w-xl`
            // box — the width ceiling now comes only from the section's own
            // `max-w-[1320px]` container above.
            className="mt-14 grid grid-cols-3 divide-x divide-white/15 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl"
          >
            {cards.map((card, index) => (
              <div key={card.key} className="px-5 py-5 sm:px-8 sm:py-6">
                <p className="font-redux-display text-3xl font-semibold leading-none text-white sm:text-4xl">
                  {/*
                    Brief §A6 (2026-11-14): counts up 0 -> value on scroll into
                    view (stagger 0/0.12/0.24s), settling back on the EXACT
                    CRM string — see `CountUpStat`'s own header for why this
                    is now safe to do without breaking the "rendered
                    verbatim" contract the earlier round deliberately upheld.
                  */}
                  <CountUpStat value={card.value} delay={index * 0.12} start={statsInView} suffixClassName="text-redux-crimson" />
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

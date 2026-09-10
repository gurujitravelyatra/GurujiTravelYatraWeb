'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import type { FeaturedVideo } from '@/content/types';
import { PhotoPlaceholder } from '@/components/ui/photo-placeholder';

export interface JourneyVideoBlockProps {
  videos: FeaturedVideo[];
}

/** Motion, verbatim from globals.css tokens — never a spring, never another duration. */
const FADE_TRANSITION = { duration: 0.18, ease: [0.25, 0.1, 0.25, 1] as const };

/**
 * Export lines 240-257, tech spec §4.4 row 5 — merges product-spec steps 5
 * ("Featured Video section") and 8 ("Every Journey Tells a Story") into one
 * block, exactly as the export does. `use client` for the play button's
 * local video-index state (§4.5).
 */
export function JourneyVideoBlock({ videos }: JourneyVideoBlockProps) {
  const [index, setIndex] = useState(0);
  const shouldReduceMotion = useReducedMotion();
  const current = videos[index % videos.length];

  const cycleVideo = () => setIndex((previous) => (previous + 1) % videos.length);

  return (
    <section
      id="journey-video"
      data-testid="section-5-8-journey-video"
      className="flex flex-wrap gap-[22px] border-t border-gty-border-6 px-gx py-[22px]"
    >
      <div className="flex w-full flex-col gap-3 760:w-[230px]">
        <p className="text-11 font-bold uppercase tracking-eyebrow-3 text-gty-primary">Explore Journeys</p>
        <h2 className="text-26 font-extrabold leading-[1.05] tracking-tightest text-gty-ink">
          Every Journey
          <br />
          Tells a Story
        </h2>
        <p className="text-11 leading-relaxed text-gty-subtle">
          We don&#39;t just plan trips,
          <br />
          we create lifetime memories.
        </p>
        <Link
          href="/tour-packages"
          className="inline-flex min-h-[42px] w-fit items-center justify-center gap-[9px] whitespace-nowrap rounded-pill border-[1.5px] border-gty-primary bg-gty-primary px-5 py-3 text-11-5 font-bold tracking-btn text-gty-white shadow-gty-btn transition-[background-color,transform] duration-gty-fast ease-gty hover:-translate-y-px hover:bg-gty-primary-deep"
        >
          Explore All Journeys <span aria-hidden="true">→</span>
        </Link>
        <div className="flex items-center gap-2 rounded-16 border border-gty-border bg-gty-white p-[6px]">
          <PhotoPlaceholder photoKey="Spiti_Valley" alt="Spiti Valley Journey" className="h-11 w-[60px] flex-none rounded-10" />
          <span className="text-9 leading-[1.3]">
            <b className="font-bold text-gty-ink">Spiti Valley Journey</b>
            <br />
            <span className="text-gty-subtle">▶ Watch Full Video</span>
          </span>
        </div>
      </div>

      <div className="min-w-[280px] flex-1">
        <div className="relative h-[230px] overflow-hidden rounded-18 bg-[#151312] shadow-gty-lift 760:h-[420px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current.thumbnailKey}
              className="absolute inset-0"
              initial={shouldReduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
              transition={FADE_TRANSITION}
            >
              <PhotoPlaceholder photoKey={current.thumbnailKey} alt={current.title} className="absolute inset-0 h-full w-full items-end p-0" />
            </motion.div>
          </AnimatePresence>
          <span
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(180deg,rgba(0,0,0,.28) 0%,rgba(0,0,0,.05) 40%,rgba(0,0,0,.62) 100%)',
            }}
          />
          <button
            type="button"
            onClick={cycleVideo}
            aria-label="Watch next trip film"
            className="absolute left-1/2 top-1/2 flex h-[76px] w-[76px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-pill bg-gty-white/94 text-24 text-gty-primary shadow-[0_10px_30px_rgba(0,0,0,.35)] transition-colors duration-gty-fast ease-gty hover:bg-gty-white"
          >
            ▶
          </button>
          <div className="absolute inset-x-5 bottom-[18px] flex flex-col gap-[5px]">
            <p className="text-10 font-bold uppercase tracking-label text-gty-white/85">Recent Trip Film</p>
            <p className="text-22 font-extrabold text-gty-white" style={{ textShadow: '0 2px 12px rgba(0,0,0,.5)' }}>
              {current.title}
            </p>
            <p className="text-12 text-gty-white/82">{current.whenLabel}</p>
          </div>
          <span className="absolute right-4 top-4 rounded-pill bg-gty-white/92 px-3 py-[6px] text-[10.5px] font-bold uppercase tracking-img">
            GTY video slot
          </span>
        </div>
      </div>
    </section>
  );
}

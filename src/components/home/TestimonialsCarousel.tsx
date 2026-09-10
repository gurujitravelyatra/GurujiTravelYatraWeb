'use client';

import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import type { Review } from '@/content/types';
import { ReviewCard } from '@/components/cards/ReviewCard';

export interface TestimonialsCarouselProps {
  testimonials: Review[];
}

/** Motion, verbatim from globals.css tokens — never a spring, never another duration. */
const FADE_TRANSITION = { duration: 0.18, ease: [0.25, 0.1, 0.25, 1] as const };

/**
 * Export lines 315-329, tech spec §4.4 row 10 ("[EXPORT, reconciled]") —
 * single-slide, arrow-driven carousel (not a swipeable multi-card row),
 * matching the export's own interaction exactly while using `ReviewCard`
 * per its §4.3 definition.
 */
export function TestimonialsCarousel({ testimonials }: TestimonialsCarouselProps) {
  const [index, setIndex] = useState(0);
  const shouldReduceMotion = useReducedMotion();
  const active = testimonials[index];

  const goPrev = () => setIndex((current) => (current - 1 + testimonials.length) % testimonials.length);
  const goNext = () => setIndex((current) => (current + 1) % testimonials.length);

  return (
    <section
      data-testid="section-10-testimonials"
      className="flex flex-col items-center gap-[14px] border-t border-gty-border-6 bg-gty-surface-5 px-gx py-6"
    >
      <div className="flex items-center gap-[10px]">
        <span aria-hidden="true" className="h-[1.5px] w-[26px] bg-gty-primary" />
        <p className="text-10 font-bold uppercase tracking-label text-gty-subtle">Testimonials</p>
        <span aria-hidden="true" className="h-[1.5px] w-[26px] bg-gty-primary" />
      </div>
      <h2 className="text-24 font-extrabold tracking-tightest text-gty-ink">What Our Travellers Say</h2>

      <div className="flex w-full flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={goPrev}
          aria-label="Previous testimonial"
          className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-pill border border-gty-border-3 text-gty-primary transition-colors duration-gty-fast ease-gty hover:border-gty-primary hover:bg-gty-primary hover:text-gty-white"
        >
          ←
        </button>

        <div className="relative min-h-[340px] w-full max-w-[360px] overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active.travellerName + index}
              initial={shouldReduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
              transition={FADE_TRANSITION}
            >
              <ReviewCard review={active} />
            </motion.div>
          </AnimatePresence>
        </div>

        <button
          type="button"
          onClick={goNext}
          aria-label="Next testimonial"
          className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-pill border border-gty-border-3 text-gty-primary transition-colors duration-gty-fast ease-gty hover:border-gty-primary hover:bg-gty-primary hover:text-gty-white"
        >
          →
        </button>
      </div>
    </section>
  );
}

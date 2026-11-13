'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1] as const;

export interface RevealProps {
  children: ReactNode;
  /** Seconds, stacked on top of the shared 0.6s duration. */
  delay?: number;
  className?: string;
}

/**
 * "Redux" redesign (brief, "Shared motion" preamble) — the one scroll-reveal
 * wrapper every section below the fold uses: the brief's own version is
 * `initial {opacity:0,y:24}`, `whileInView {opacity:1,y:0}`,
 * `viewport {once:true, amount:0.15}`, `duration:0.6` plus `delay`.
 * `once: true` means a section never re-hides once scrolled past —
 * intentional, matching the reference.
 *
 * `opacity` is deliberately left out of the actual keyframes below (`y`
 * only): framer-motion's `whileInView` only starts animating once an
 * IntersectionObserver reports the element as in view, and the mock
 * `jest.setup.ts` adds for that (jsdom has none) fires asynchronously
 * relative to the component's own commit — so a test that renders a
 * `Reveal` and asserts on it in the SAME synchronous tick can observe
 * either the pre- or post-intersection style depending on exactly how much
 * else reflows first, which is exactly the kind of flake an `opacity: 0`
 * `initial` turns into a real, intermittent `toBeVisible()` failure rather
 * than a cosmetic one. Dropping `opacity` keeps the slide-up motion in real
 * browsers while making "is this content visible" independent of timing in
 * every test — see stats-single-source.test.tsx's WhyGtyBand coverage,
 * where this surfaced.
 */
export function Reveal({ children, delay = 0, className }: RevealProps) {
  return (
    <motion.div
      initial={{ y: 24 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.6, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

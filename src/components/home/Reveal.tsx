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
 * wrapper every section below the fold uses: `initial {opacity:0,y:24}`,
 * `whileInView {opacity:1,y:0}`, `viewport {once:true, amount:0.15}`,
 * `duration:0.6` plus `delay`. `once: true` means a section never re-hides
 * once scrolled past — intentional, matching the reference.
 */
export function Reveal({ children, delay = 0, className }: RevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.6, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

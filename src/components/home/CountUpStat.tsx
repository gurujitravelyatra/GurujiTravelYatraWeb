'use client';

import { useEffect, useRef, useState } from 'react';
import { animate } from 'framer-motion';

import { parseCountableStat } from '@/lib/count-up-stat';

export interface CountUpStatProps {
  /** The exact CRM stat string ("10,000+") — rendered verbatim before/after the animation. */
  value: string;
  /** The per-card stagger (0, 0.12, 0.24) — the brief's own `delay: 1 + stagger` adds the 1s baseline. */
  stagger: number;
  /** Shared trigger — every card in a stats band starts from the same `useInView` flip. */
  start: boolean;
  /** Applied to the trailing suffix only ("+" in red), per brief §A6. */
  suffixClassName?: string;
}

/**
 * Brief §3 (2026-11-14 round) / §A6-A7 (2026-11-14 "Redux" round): counts a
 * CRM stat up from 0 via framer-motion's imperative `animate(0, value,
 * {duration: 1.8, delay: 1 + stagger, ease: "easeOut"})`, exactly as the
 * spec names it, then settles on the EXACT CRM string — never a re-derived
 * one — so the "rendered verbatim" contract (`Hero`/`WhyGtyBand`'s own
 * header) holds at rest, before AND after the animation runs.
 *
 * "Render the FINAL value in the server HTML... never show 0+ ... when
 * JavaScript is blocked": `useState`'s initializer runs during SSR too, so
 * the server-rendered HTML already contains the real digits — there is no
 * server-rendered "0" state at all, and with JS blocked (no hydration, no
 * effect) this is simply what stays on screen forever.
 *
 * The animation itself never mutates state synchronously during the mount
 * effect — framer-motion's `animate()` schedules its first tick via a real
 * timer/rAF, never inline — so a synchronous `getByText(value)` right after
 * `render()` in a unit test still sees the untouched CRM string, matching
 * every existing stats test.
 */
export function CountUpStat({ value, stagger, start, suffixClassName }: CountUpStatProps) {
  const parsed = parseCountableStat(value);
  const [displayNumber, setDisplayNumber] = useState(parsed?.rawDigits ?? value);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!start || !parsed || startedRef.current) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    startedRef.current = true;

    const controls = animate(0, parsed.target, {
      duration: 1.8,
      delay: 1 + stagger,
      ease: 'easeOut',
      onUpdate: (latest) => setDisplayNumber(Math.round(latest).toLocaleString('en-IN')),
      onComplete: () => setDisplayNumber(parsed.rawDigits),
    });

    return () => controls.stop();
  }, [start, parsed, stagger]);

  if (!parsed) return <>{value}</>;

  return (
    <>
      {displayNumber}
      {parsed.suffix && <span className={suffixClassName}>{parsed.suffix}</span>}
    </>
  );
}

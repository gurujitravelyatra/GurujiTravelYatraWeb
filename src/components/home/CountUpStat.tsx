'use client';

import { useEffect, useRef, useState } from 'react';

import { parseCountableStat } from '@/lib/count-up-stat';

export interface CountUpStatProps {
  /** The exact CRM stat string ("10,000+") — rendered verbatim before/after the animation. */
  value: string;
  /** Seconds to wait before starting, once `start` flips true (brief's per-card stagger). */
  delay: number;
  /** Shared trigger — every card in a stats band starts from the same `useInView` flip. */
  start: boolean;
  /** Applied to the trailing suffix only ("+" in red), per brief §A6. */
  suffixClassName?: string;
}

const DURATION_MS = 1800;

/**
 * Brief §A6/§A7 (2026-11-14): counts a CRM stat up from 0 with an easeOut
 * curve once its stats band scrolls into view, then settles on the EXACT
 * CRM string — never a re-derived one — so the "rendered verbatim" contract
 * (`Hero`/`WhyGtyBand`'s own header) holds at rest, before and after the
 * animation runs.
 *
 * The first state mutation happens inside a `setTimeout` callback, never
 * synchronously in the mount effect — `useInView`'s IntersectionObserver
 * (mocked in `jest.setup.ts` to fire synchronously) can flip `start` true
 * within the same render pass a unit test asserts on. Deferring to a real
 * timer/rAF tick means a synchronous `getByText(value)` right after
 * `render()` still sees the untouched CRM string, matching every existing
 * stats test — the animation itself is unverified by jsdom (no real rAF
 * clock advances in those tests), which is fine: it is a progressive-
 * enhancement effect, not the fact being tested.
 */
export function CountUpStat({ value, delay, start, suffixClassName }: CountUpStatProps) {
  const parsed = parseCountableStat(value);
  const [displayNumber, setDisplayNumber] = useState(parsed?.rawDigits ?? value);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!start || !parsed || startedRef.current) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    startedRef.current = true;

    let rafId = 0;
    const timeoutId = window.setTimeout(() => {
      const startTime = performance.now();
      const tick = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / DURATION_MS, 1);
        const eased = 1 - (1 - progress) ** 3;
        if (progress < 1) {
          setDisplayNumber(Math.round(parsed.target * eased).toLocaleString('en-IN'));
          rafId = window.requestAnimationFrame(tick);
        } else {
          setDisplayNumber(parsed.rawDigits);
        }
      };
      rafId = window.requestAnimationFrame(tick);
    }, delay * 1000);

    return () => {
      window.clearTimeout(timeoutId);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [start, parsed, delay]);

  if (!parsed) return <>{value}</>;

  return (
    <>
      {displayNumber}
      {parsed.suffix && <span className={suffixClassName}>{parsed.suffix}</span>}
    </>
  );
}

import * as React from 'react';
import { render, screen } from '@testing-library/react';

/**
 * Tech spec §9 item 13 spot-check, on `ModalShell` enter/exit: when
 * `prefers-reduced-motion: reduce` is active, the backdrop/content must mount
 * already in their final ("animate") state — `initial={false}` in the
 * component — instead of animating in from the faded/scaled-down state, and
 * must not fade/scale back out on exit.
 *
 * This asserts the props ModalShell *hands to* framer-motion rather than the
 * inline styles framer-motion computes, for two reasons:
 *   1. framer-motion's real `useReducedMotion` resolves `matchMedia` into
 *      module-level state on first import, so reassigning `window.matchMedia`
 *      between tests does not change it — the first test's value leaks into
 *      every later one.
 *   2. Whether an `initial` value is still on the element as an inline style
 *      by assertion time depends on rAF/act() flush timing in jsdom, which is
 *      framer-motion's internal detail, not ModalShell's contract.
 */

let mockReducedMotion = false;
interface CapturedMotionProps {
  className?: string;
  initial?: unknown;
  animate?: unknown;
  exit?: unknown;
}
const capturedMotionProps: CapturedMotionProps[] = [];

jest.mock('framer-motion', () => {
  const React_ = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    useReducedMotion: () => mockReducedMotion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => React_.createElement(
      React_.Fragment,
      null,
      children
    ),
    motion: new Proxy(
      {},
      {
        get: () =>
          React_.forwardRef<HTMLDivElement, Record<string, unknown>>(function MotionMock(props, ref) {
            const { initial, animate, exit, transition, children, ...rest } = props as CapturedMotionProps & {
              transition?: unknown;
              children?: React.ReactNode;
            } & Record<string, unknown>;
            capturedMotionProps.push({ className: rest.className as string, initial, animate, exit });
            return React_.createElement('div', { ...rest, ref }, children);
          }),
      }
    ),
  };
});

// Imported after the mock so ModalShell picks up the mocked framer-motion.
import { ModalShell } from '../ModalShell';

/** The dialog panel is the motion element carrying the `scale`/`y` enter transform. */
function contentProps() {
  return capturedMotionProps.find((p) => p.className?.includes('rounded-22'));
}

/** The backdrop is the fixed-inset motion element that only ever animates opacity. */
function overlayProps() {
  return capturedMotionProps.find((p) => p.className?.includes('backdrop-blur'));
}

function renderShell() {
  render(
    <ModalShell open onOpenChange={jest.fn()} title="Test modal" description="desc">
      <p>modal body</p>
    </ModalShell>
  );
}

describe('ModalShell — prefers-reduced-motion', () => {
  beforeEach(() => {
    capturedMotionProps.length = 0;
  });

  it('mounts content and backdrop already in their final state when reduced motion is on', () => {
    mockReducedMotion = true;
    renderShell();

    expect(screen.getByText('modal body')).toBeInTheDocument();

    // `initial={false}` is framer-motion's "skip the enter animation, render
    // at the animate values" signal.
    expect(contentProps()?.initial).toBe(false);
    expect(overlayProps()?.initial).toBe(false);

    // Exit must not fade/scale away either — it stays at the resting values.
    expect(contentProps()?.exit).toEqual({ opacity: 1, scale: 1, y: 0 });
    expect(overlayProps()?.exit).toEqual({ opacity: 1 });
  });

  it('mounts content in its faded/scaled-down initial state when motion is NOT reduced', () => {
    mockReducedMotion = false;
    renderShell();

    expect(screen.getByText('modal body')).toBeInTheDocument();

    expect(contentProps()?.initial).toEqual({ opacity: 0, scale: 0.96, y: 8 });
    expect(contentProps()?.animate).toEqual({ opacity: 1, scale: 1, y: 0 });
    expect(contentProps()?.exit).toEqual({ opacity: 0, scale: 0.96, y: 8 });

    expect(overlayProps()?.initial).toEqual({ opacity: 0 });
    expect(overlayProps()?.exit).toEqual({ opacity: 0 });
  });
});

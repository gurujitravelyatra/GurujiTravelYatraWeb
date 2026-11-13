import '@testing-library/jest-dom';

/**
 * CRM-migration Step 3: `LeadModal.tsx` reads
 * `NEXT_PUBLIC_TURNSTILE_SITE_KEY` at module load to decide whether to
 * render `TurnstileWidget` at all (unset is a supported production mode —
 * see that module's own comment). Every `LeadModal` test mocks
 * `TurnstileWidget` itself (`src/components/modals/__mocks__/
 * TurnstileWidget.tsx`) rather than loading the real Cloudflare script, so
 * this only needs to be NON-EMPTY to take the "render the widget" branch —
 * its value is never sent anywhere in a test. Forced to a fixed value for
 * the same hermetic-suite reason `DATABASE_URL` is deleted above: a real
 * `.env` setting it (or not) must never change which branch these tests
 * exercise.
 */
process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'test-turnstile-site-key';

/**
 * jsdom does not implement `matchMedia`. Both `useMediaQuery`
 * (src/hooks/use-media-query.ts) and framer-motion's `useReducedMotion`
 * (used by ModalShell/LeadModal) call it unconditionally, so every test that
 * renders those needs it defined even when a given test doesn't care about
 * its result. Default: nothing matches (no reduced motion, no breakpoint
 * hit). Individual tests override `window.matchMedia` when they need a
 * specific query to match.
 */
/**
 * jsdom does not implement `IntersectionObserver` either, and the "Redux"
 * home-page redesign (2026-11-14) uses framer-motion's `whileInView` for
 * most of its scroll-reveal animations — every one of them throws
 * `ReferenceError: IntersectionObserver is not defined` the moment the
 * component mounts in a test, not just something that silently stays
 * un-animated. This mock fires every observed target as immediately
 * intersecting, synchronously, so `whileInView` treats content as already
 * in view and renders its `animate` (visible) state rather than getting
 * stuck in `ReferenceError` territory or a frozen `initial` (invisible)
 * one — the same `toBeVisible()`-breaks-on-animated-content problem
 * documented on Hero.tsx's hero-stats motion.div, solved once here instead
 * of per component.
 */
if (typeof window !== 'undefined' && typeof window.IntersectionObserver === 'undefined') {
  class MockIntersectionObserver implements IntersectionObserver {
    readonly root: Element | Document | null = null;
    readonly rootMargin: string = '';
    readonly thresholds: ReadonlyArray<number> = [];
    private readonly callback: IntersectionObserverCallback;

    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback;
    }

    observe(target: Element): void {
      const entry = {
        isIntersecting: true,
        target,
        boundingClientRect: target.getBoundingClientRect(),
        intersectionRatio: 1,
        intersectionRect: target.getBoundingClientRect(),
        rootBounds: null,
        time: Date.now(),
      } as IntersectionObserverEntry;
      this.callback([entry], this);
    }

    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }

  window.IntersectionObserver = MockIntersectionObserver;
}

if (typeof window !== 'undefined') {
  window.matchMedia =
    window.matchMedia ||
    function matchMediaMock(query: string): MediaQueryList {
      return {
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      } as unknown as MediaQueryList;
    };
}

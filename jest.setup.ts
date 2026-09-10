import '@testing-library/jest-dom';

/**
 * jsdom does not implement `matchMedia`. Both `useMediaQuery`
 * (src/hooks/use-media-query.ts) and framer-motion's `useReducedMotion`
 * (used by ModalShell/LeadModal) call it unconditionally, so every test that
 * renders those needs it defined even when a given test doesn't care about
 * its result. Default: nothing matches (no reduced motion, no breakpoint
 * hit). Individual tests override `window.matchMedia` when they need a
 * specific query to match.
 */
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

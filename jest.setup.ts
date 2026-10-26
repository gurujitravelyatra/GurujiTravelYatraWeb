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

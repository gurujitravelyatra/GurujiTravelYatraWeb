import * as React from 'react';

/**
 * Manual Jest mock for `TurnstileWidget` — picked up automatically by any
 * test that calls `jest.mock('../TurnstileWidget')` or
 * `jest.mock('@/components/modals/TurnstileWidget')` with no factory.
 *
 * Calls `onVerify` with a fixed fake token the instant it mounts, so every
 * `LeadModal` test that fills the form and submits gets a "solved" widget
 * without ever touching the real Cloudflare script — this project's modals
 * never load `challenges.cloudflare.com` in a test, by design (see
 * `TurnstileWidget.tsx`'s own header, "Test/SSR safety").
 */
export const FAKE_TURNSTILE_TOKEN = 'test-turnstile-token';

export function TurnstileWidget({ onVerify }: { onVerify: (token: string) => void; onExpire: () => void }) {
  React.useEffect(() => {
    onVerify(FAKE_TURNSTILE_TOKEN);
    // Only on mount — re-invoking on every render would fight a test that
    // deliberately wants to exercise the "not yet verified" state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div data-testid="turnstile-widget-mock" />;
}

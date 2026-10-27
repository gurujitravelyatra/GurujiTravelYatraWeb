import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Aliased — a bare `import Error from '../error'` shadows the global
// `Error` constructor this file also needs to construct fixture errors
// with.
import ErrorFallback from '../error';

/**
 * Production incident 2026-10-27 (Bug 3) — this is the friendly fallback
 * every page in `src/app/**` now degrades to instead of Next's generic
 * 500, on any thrown render error. Deliberately a plain unit test of the
 * component itself (`render`/`retry` directly), not an end-to-end
 * "throw inside a real route and see the boundary catch it" test — that
 * is Next's own error-boundary machinery to exercise, not this codebase's;
 * this file just proves what the fallback SHOWS and DOES.
 */

describe('app/error.tsx — the shared error boundary fallback', () => {
  it('shows a friendly message and never the raw error text', () => {
    render(<ErrorFallback error={new Error('ENOTFOUND gty-crm.railway.internal')} retry={jest.fn()} />);

    expect(screen.getByText(/something went wrong on our end/i)).toBeInTheDocument();
    expect(screen.queryByText(/ENOTFOUND/)).not.toBeInTheDocument();
  });

  it('shows the error digest when Next supplies one, for correlating with server logs', () => {
    const error = new Error('generic message') as Error & { digest?: string };
    error.digest = 'abc123digest';

    render(<ErrorFallback error={error} retry={jest.fn()} />);

    expect(screen.getByText('abc123digest')).toBeInTheDocument();
  });

  it('renders no digest line at all when none is present, rather than "undefined"', () => {
    render(<ErrorFallback error={new Error('x')} retry={jest.fn()} />);

    expect(screen.queryByText(/Reference:/)).not.toBeInTheDocument();
    expect(screen.queryByText('undefined')).not.toBeInTheDocument();
  });

  it('"Try again" calls the retry() callback Next supplies', async () => {
    const user = userEvent.setup();
    const retry = jest.fn();

    render(<ErrorFallback error={new Error('x')} retry={retry} />);
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('offers a real way back to the site and a real phone number, never a dead end', () => {
    render(<ErrorFallback error={new Error('x')} retry={jest.fn()} />);

    expect(screen.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: '+91 90999 57658' })).toHaveAttribute('href', 'tel:+919099957658');
  });
});

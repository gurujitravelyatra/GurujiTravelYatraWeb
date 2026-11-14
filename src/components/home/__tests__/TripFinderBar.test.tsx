import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TripFinderBar } from '../TripFinderBar';
import { tripFinderTabs } from '@/lib/trip-finder-tabs';

const push = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

/**
 * Brief §B (2026-11-14): "Explore Now" now POSTs to `/api/trip-finder` and
 * navigates to whatever URL the server resolves — this component holds no
 * routing logic of its own (`resolve.ts`'s own unit tests own the routing
 * RULES; this file only owns "does the bar call the API correctly and
 * reflect what came back").
 */
const mockFetch = jest.fn();

beforeEach(() => {
  push.mockReset();
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ data: { url: '/tour-packages?category=Spiritual', isFallbackToCustom: false } }),
  });
  global.fetch = mockFetch as unknown as typeof fetch;
});

function renderBar(suggestions: string[] = []) {
  return render(<TripFinderBar destinationSuggestions={suggestions} />);
}

describe('TripFinderBar', () => {
  it('renders every tab, with the first one active and its hint showing', () => {
    renderBar();

    for (const tab of tripFinderTabs) {
      expect(screen.getByRole('button', { name: tab.name })).toBeInTheDocument();
    }

    expect(screen.getByRole('button', { name: 'Spiritual Yatra' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(tripFinderTabs[0].hint)).toBeInTheDocument();
  });

  it('swaps the hint when another tab is selected', async () => {
    const user = userEvent.setup();
    renderBar();

    await user.click(screen.getByRole('button', { name: 'Custom Trip' }));

    expect(screen.getByText(tripFinderTabs[4].hint)).toBeInTheDocument();
    expect(screen.queryByText(tripFinderTabs[0].hint)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Custom Trip' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('every field is a real, working control — no "SOON" chip anywhere', () => {
    renderBar();

    expect(screen.getByLabelText('Where do you want to go?')).toBeEnabled();
    expect(screen.getByLabelText('Journey month')).toBeEnabled();
    expect(screen.getByLabelText('Travellers')).toBeEnabled();
    expect(screen.queryByText('SOON')).not.toBeInTheDocument();
  });

  it('Travellers defaults to 2, and Journey month defaults to "Any month"', () => {
    renderBar();

    expect(screen.getByLabelText('Travellers')).toHaveValue('2');
    expect(screen.getByLabelText('Journey month')).toHaveValue('');
    expect(screen.getByText('Any month')).toBeInTheDocument();
  });

  describe('"Explore Now" — real server-resolved routing', () => {
    it('POSTs the active tab + every field, then navigates to the resolved URL', async () => {
      const user = userEvent.setup();
      renderBar(['Kerala']);

      await user.click(screen.getByRole('button', { name: 'Family Holiday' }));
      await user.type(screen.getByLabelText('Where do you want to go?'), 'Kerala');
      await user.selectOptions(screen.getByLabelText('Journey month'), 'July');
      await user.selectOptions(screen.getByLabelText('Travellers'), '3-4');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { url: '/tour-packages?category=Family&place=munnar', isFallbackToCustom: false } }),
      });

      await user.click(screen.getByTestId('trip-finder-cta'));

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/trip-finder',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ tab: 'family', destination: 'Kerala', month: 'July', travellers: '3-4' }),
        })
      );
      await waitFor(() => expect(push).toHaveBeenCalledWith('/tour-packages?category=Family&place=munnar'));
    });

    it('shows the loading state and blocks a second click while a request is in flight', async () => {
      const user = userEvent.setup();
      renderBar();
      let resolveFetch!: (value: unknown) => void;
      mockFetch.mockReturnValueOnce(new Promise((resolve) => (resolveFetch = resolve)));

      const button = screen.getByTestId('trip-finder-cta');
      await user.click(button);

      expect(screen.getByText('Searching…')).toBeInTheDocument();
      expect(button).toBeDisabled();

      await user.click(button); // no-op — must not fire a second request
      expect(mockFetch).toHaveBeenCalledTimes(1);

      resolveFetch({ ok: true, json: async () => ({ data: { url: '/tour-packages', isFallbackToCustom: false } }) });
      await waitFor(() => expect(push).toHaveBeenCalled());
    });

    it('shows the fallback-to-Custom message, naming the typed destination, without crashing', async () => {
      const user = userEvent.setup();
      renderBar();
      await user.type(screen.getByLabelText('Where do you want to go?'), 'Nowhereland');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { url: '/customize-tours?destination=Nowhereland', isFallbackToCustom: true } }),
      });

      await user.click(screen.getByTestId('trip-finder-cta'));

      expect(await screen.findByText("No ready-made tour for Nowhereland, let's design one for you.")).toBeInTheDocument();
      expect(push).toHaveBeenCalledWith('/customize-tours?destination=Nowhereland');
    });

    it('shows the Group-tab month-mismatch note instead of the tab hint, and still navigates (never redirected to Custom for this reason)', async () => {
      const user = userEvent.setup();
      renderBar();
      await user.click(screen.getByRole('button', { name: 'Group Tour' }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { url: '/tour-packages/char-dham', isFallbackToCustom: false, monthMismatchNote: 'No departure in July, here are the upcoming dates' },
        }),
      });

      await user.click(screen.getByTestId('trip-finder-cta'));

      expect(await screen.findByText('No departure in July, here are the upcoming dates')).toBeInTheDocument();
      expect(push).toHaveBeenCalledWith('/tour-packages/char-dham');
    });

    it('recovers with a visible message if the request itself fails, rather than hanging silently', async () => {
      const user = userEvent.setup();
      renderBar();
      mockFetch.mockRejectedValueOnce(new Error('network down'));

      await user.click(screen.getByTestId('trip-finder-cta'));

      expect(await screen.findByText(/couldn't check that/i)).toBeInTheDocument();
      expect(screen.getByTestId('trip-finder-cta')).toBeEnabled();
    });
  });

  describe('destination suggestions', () => {
    it('offers the real CRM place names/states it is given, never invented ones', () => {
      renderBar(['Goa', 'Himachal Pradesh']);
      const input = screen.getByLabelText('Where do you want to go?');
      const datalistId = input.getAttribute('list');

      expect(datalistId).toBeTruthy();
      const options = document.querySelectorAll(`#${datalistId} option`);
      expect(Array.from(options).map((option) => (option as HTMLOptionElement).value)).toEqual(['Goa', 'Himachal Pradesh']);
    });
  });

  describe('hint copy asserts nothing the product cannot back', () => {
    // Group IS now real departure-checking (brief §B item 2) — exempt only
    // that tab from the "never claims departures" rule below.
    const bannedClaims: [label: string, pattern: RegExp, exemptTabName?: string][] = [
      ['seat availability', /\bseats?\b/i],
      ['live availability', /availab(le|ility)/i],
      ['a trip builder', /trip builder|itinerary builder|wizard/i],
      ['a multi-question flow', /\bquestions?\b|questionnaire/i],
      ['instant booking', /book (now|instantly)|instant (booking|confirmation)/i],
      ['departure scheduling, on any tab but Group', /\bdepartures?\b|\bdeparting\b/i, 'Group Tour'],
    ];

    for (const [label, pattern, exemptTabName] of bannedClaims) {
      it(`never claims ${label}`, () => {
        for (const tab of tripFinderTabs) {
          if (tab.name === exemptTabName) continue;
          expect(tab.hint).not.toMatch(pattern);
        }
      });
    }

    it('does not use the old "Showing …" framing, which implied the tab filters the page', () => {
      for (const tab of tripFinderTabs) {
        expect(tab.hint).not.toMatch(/^showing\b/i);
      }
    });
  });
});

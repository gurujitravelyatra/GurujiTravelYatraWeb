import { render, screen, within } from '@testing-library/react';

import { TripSummaryCard, type TripSummaryCardProps } from '../TripSummaryCard';

function renderCard(overrides: Partial<TripSummaryCardProps> = {}) {
  const props: TripSummaryCardProps = {
    totalStops: 0,
    tripHeadline: 'Empty Trip',
    tripRouteLabel: 'Your selected places will appear here in order.',
    travelStyleLabel: 'Comfort',
    travelMonthLabel: 'Any month',
    travellersLabel: '2 Adults',
    onGetQuote: jest.fn(),
    whatsappHref: 'https://wa.me/919099957658?text=hi',
    ...overrides,
  };
  render(<TripSummaryCard {...props} />);
  return props;
}

/**
 * The export derives "Estimated Cost (Per Person)" as
 * `nights * (3200|5400|8600)` — per-night rates that appear in no spec, price
 * list or fixture (places.fixture.ts doc comment). That is a fabricated price
 * quote. This suite guards against it ever being reintroduced: the row must
 * always read "On request", visibly marked unconfirmed, and must NEVER
 * contain a ₹-prefixed number, regardless of how many nights/stops are passed.
 */
describe('TripSummaryCard estimated cost never shows a fabricated ₹ figure', () => {
  function costRow() {
    const dt = screen.getByText('Estimated Cost (Per Person)');
    return dt.closest('div')!;
  }

  it('renders "On request" with its unconfirmed-figure marker for an empty trip', () => {
    renderCard({ totalStops: 0, tripHeadline: 'Empty Trip' });

    const row = costRow();
    expect(within(row).getByText('On request')).toBeInTheDocument();
    expect(within(row).getByTestId('trip-cost-placeholder-marker')).toBeInTheDocument();
  });

  it('still renders "On request" for a multi-stop, multi-night trip — never a computed ₹ amount', () => {
    renderCard({
      totalStops: 3,
      tripHeadline: '14 nights / 15 days',
      tripRouteLabel: 'Kedarnath → Badrinath → Rishikesh',
      travelStyleLabel: 'Luxury',
    });

    const row = costRow();
    expect(within(row).getByText('On request')).toBeInTheDocument();
    // The old export formula: 14 nights * 8600 (Luxury) = ₹120,400. Guard
    // explicitly that no such number, or any ₹-prefixed figure, ever appears.
    expect(row.textContent).not.toMatch(/₹[\d,]+/);
  });

  it('never renders a rupee sign anywhere in the estimated cost row, across every travel style', () => {
    for (const travelStyleLabel of ['Budget', 'Comfort', 'Premium', 'Luxury']) {
      const { unmount } = render(
        <TripSummaryCard
          totalStops={2}
          tripHeadline="6 nights / 7 days"
          tripRouteLabel="Manali → Spiti Valley"
          travelStyleLabel={travelStyleLabel}
          travelMonthLabel="October"
          travellersLabel="2 Adults, 1 Child"
          onGetQuote={jest.fn()}
          whatsappHref="https://wa.me/919099957658"
        />
      );

      const row = screen.getByText('Estimated Cost (Per Person)').closest('div')!;
      expect(row.textContent).not.toContain('₹');
      unmount();
    }
  });

  it('carries a footnote explaining a planner will confirm the price, wired via aria-describedby', () => {
    renderCard();

    const group = screen.getByRole('group', { name: 'Your trip summary' });
    const describedById = group.getAttribute('aria-describedby');
    expect(describedById).toBeTruthy();

    const note = document.getElementById(describedById!);
    expect(note).toBeInTheDocument();
    expect(note).toHaveTextContent(/confirm.*price/i);
  });
});

describe('TripSummaryCard other rows', () => {
  it('renders totalStops, travel style, travel month and travellers from props', () => {
    renderCard({
      totalStops: 2,
      travelStyleLabel: 'Premium',
      travelMonthLabel: 'November',
      travellersLabel: '3 Adults, 2 Children',
    });

    expect(within(screen.getByText('Total Stops').closest('div')!).getByText('2')).toBeInTheDocument();
    expect(within(screen.getByText('Travel Style').closest('div')!).getByText('Premium')).toBeInTheDocument();
    expect(within(screen.getByText('Travel Month').closest('div')!).getByText('November')).toBeInTheDocument();
    expect(within(screen.getByText('Travellers').closest('div')!).getByText('3 Adults, 2 Children')).toBeInTheDocument();
  });

  it('invokes onGetQuote when "Get My Custom Quote" is clicked', async () => {
    const { onGetQuote } = renderCard();
    screen.getByRole('button', { name: /Get My Custom Quote/ }).click();
    expect(onGetQuote).toHaveBeenCalledTimes(1);
  });

  it('renders the WhatsApp link with the given href', () => {
    renderCard({ whatsappHref: 'https://wa.me/919099957658?text=Hello' });
    const link = screen.getByRole('link', { name: /Send Route on WhatsApp/ });
    expect(link).toHaveAttribute('href', 'https://wa.me/919099957658?text=Hello');
    expect(link).toHaveAttribute('target', '_blank');
  });
});

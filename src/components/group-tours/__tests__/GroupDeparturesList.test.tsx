import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { GroupDeparturesList } from '../GroupDeparturesList';
import type { CrmDeparturesTourCard } from '@/server/crm/types';

jest.mock('@/components/modals/modal-context', () => ({
  useModal: () => ({ modal: null, openEnquiry: jest.fn(), openBrochure: jest.fn(), close: jest.fn() }),
}));

function tour(overrides: Partial<CrmDeparturesTourCard>): CrmDeparturesTourCard {
  return {
    slug: 'tour',
    name: 'Tour',
    category: 'Adventure',
    shortDescription: 'A trip.',
    coverImageUrl: 'https://res.cloudinary.com/tour-images/abc.jpg',
    price: { amount: 25000, currency: 'INR' },
    durationDays: 6,
    durationNights: 5,
    departureCity: null,
    primaryPlace: { name: 'Place', slug: 'place' },
    nextDeparture: { date: '2026-07-01', seatsLeft: 8 },
    hasBrochure: true,
    departureDate: '2026-07-01',
    ...overrides,
  };
}

const departures: CrmDeparturesTourCard[] = [
  tour({ slug: 'july-1', name: 'July Departure One', departureDate: '2026-07-01' }),
  tour({ slug: 'july-2', name: 'July Departure Two', departureDate: '2026-07-15' }),
  tour({ slug: 'aug-1', name: 'August Departure', departureDate: '2026-08-05' }),
];
const months = ['2026-07', '2026-08'];

function renderList() {
  return render(<GroupDeparturesList departures={departures} months={months} />);
}

/**
 * CRM-migration Step 2: month chips now filter by `departureDate`'s
 * `YYYY-MM` prefix, using the CRM's own `months` list verbatim — no more
 * `departureMonthKeys()`/year-guessing.
 */
describe('GroupDeparturesList', () => {
  it('renders a month chip for every CRM-provided month, each with aria-pressed', () => {
    renderList();
    const group = screen.getByRole('group', { name: 'Filter by departure month' });

    for (const month of months) {
      expect(within(group).getByRole('button', { name: month })).toHaveAttribute('aria-pressed', 'false');
    }
    expect(within(group).getByRole('button', { name: 'All Departures' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking a month chip filters the visible departures to that month', async () => {
    const user = userEvent.setup();
    renderList();

    await user.click(screen.getByRole('button', { name: '2026-07' }));

    expect(screen.getByRole('heading', { name: 'July Departure One' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'July Departure Two' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'August Departure' })).not.toBeInTheDocument();
  });

  it('clicking "All Departures" restores every departure', async () => {
    const user = userEvent.setup();
    renderList();

    await user.click(screen.getByRole('button', { name: '2026-08' }));
    await user.click(screen.getByRole('button', { name: 'All Departures' }));

    for (const departure of departures) {
      expect(screen.getByRole('heading', { name: departure.name })).toBeInTheDocument();
    }
  });

  it('updates the aria-live result count as the filter changes', async () => {
    const user = userEvent.setup();
    renderList();

    expect(screen.getByText('3 departures found')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '2026-08' }));
    expect(screen.getByText('1 departure found')).toBeInTheDocument();
  });

  it('renders a "no departures" state when the filter matches nothing', async () => {
    const user = userEvent.setup();
    render(<GroupDeparturesList departures={departures} months={['2026-07', '2026-08', '2026-09']} />);

    await user.click(screen.getByRole('button', { name: '2026-09' }));
    expect(screen.getByText('No departures match this month yet.')).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { GroupDepartureCard } from '../GroupDepartureCard';
import type { CrmDeparturesTourCard } from '@/server/crm/types';

const openEnquiry = jest.fn();
const openBrochure = jest.fn();
const openGroupReservation = jest.fn();
jest.mock('@/components/modals/modal-context', () => ({
  useModal: () => ({
    modal: null,
    openEnquiry,
    openBrochure,
    openGroupReservation,
    openCustomTrip: jest.fn(),
    close: jest.fn(),
  }),
}));

/**
 * CRM-migration Step 2: `GET /public/departures` returns a tour card plus a
 * `departureDate` — not the old richly-detailed `GroupDeparture` model.
 * Boarding points, tour-manager text, the script-accent overlay and the
 * `durationUnverified`/`priceUnverified` markers are gone for good; this
 * suite tests exactly what the new card renders.
 */
const bookable: CrmDeparturesTourCard = {
  slug: 'kashmir-paradise',
  name: 'Kashmir Paradise',
  category: 'Adventure',
  shortDescription: 'A week in the valley.',
  coverImageUrl: 'https://res.cloudinary.com/tour-images/abc.jpg',
  price: { amount: 25000, currency: 'INR' },
  durationDays: 6,
  durationNights: 5,
  departureCity: null,
  primaryPlace: { name: 'Srinagar', slug: 'srinagar' },
  nextDeparture: { date: '2026-07-01', seatsLeft: 8 },
  hasBrochure: true,
  departureDate: '2026-07-01',
};

const soldOut: CrmDeparturesTourCard = {
  ...bookable,
  slug: 'full-batch',
  name: 'Fully Booked Yatra',
  nextDeparture: { date: '2026-07-01', seatsLeft: 0 },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GroupDepartureCard', () => {
  it('renders name, date, duration, price and seats', () => {
    render(<GroupDepartureCard departure={bookable} />);

    expect(screen.getByRole('heading', { name: bookable.name })).toBeInTheDocument();
    expect(screen.getByText(bookable.departureDate)).toBeInTheDocument();
    expect(screen.getByText('6 Days 5 Nights')).toBeInTheDocument();
    expect(screen.getByText('₹25,000')).toBeInTheDocument();
    expect(screen.getByText('8 seats left')).toBeInTheDocument();
  });

  it('never renders a struck-through "was" price or a "Save ₹X" badge', () => {
    render(<GroupDepartureCard departure={bookable} />);
    expect(screen.queryByText(/^Save ₹/)).not.toBeInTheDocument();
  });

  it('renders "Price on request" instead of "₹0" for a missing/zero price', () => {
    render(<GroupDepartureCard departure={{ ...bookable, price: { amount: 0, currency: 'INR' } }} />);
    expect(screen.getByText('Price on request')).toBeInTheDocument();
    expect(screen.queryByText('₹0')).not.toBeInTheDocument();
  });

  describe('"Reserve a Seat" submits a group-tour-reservation, not a generic enquiry', () => {
    it('passes the tour name AND its departure date', async () => {
      const user = userEvent.setup();
      render(<GroupDepartureCard departure={bookable} />);

      await user.click(screen.getByRole('button', { name: /Reserve a Seat/ }));

      expect(openGroupReservation).toHaveBeenCalledTimes(1);
      expect(openGroupReservation).toHaveBeenCalledWith({
        departureName: bookable.name,
        batchDate: bookable.departureDate,
      });
      expect(openEnquiry).not.toHaveBeenCalled();
    });

    it('"Get Brochure" opens the brochure modal with the tour as context', async () => {
      const user = userEvent.setup();
      render(<GroupDepartureCard departure={bookable} />);

      await user.click(screen.getByRole('button', { name: /Get Brochure/ }));

      expect(openBrochure).toHaveBeenCalledWith({ label: 'Group Tour', value: bookable.name });
      expect(openGroupReservation).not.toHaveBeenCalled();
    });
  });

  describe('sold-out behaviour', () => {
    it('renders the "This journey is currently full." notice and no Reserve CTA', () => {
      render(<GroupDepartureCard departure={soldOut} />);

      expect(screen.getByText('This journey is currently full.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Reserve a Seat/ })).not.toBeInTheDocument();
    });

    it('a bookable departure renders an enabled Reserve CTA and no sold-out notice', () => {
      render(<GroupDepartureCard departure={bookable} />);

      expect(screen.getByRole('button', { name: /Reserve a Seat/ })).toBeEnabled();
      expect(screen.queryByText('This journey is currently full.')).not.toBeInTheDocument();
    });

    it('always renders "Get Brochure", sold out or not', () => {
      render(<GroupDepartureCard departure={soldOut} />);
      expect(screen.getByRole('button', { name: /Get Brochure/ })).toBeEnabled();
    });
  });
});

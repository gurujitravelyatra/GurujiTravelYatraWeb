import { render, screen } from '@testing-library/react';

import { GroupDepartureCard } from '../GroupDepartureCard';
import { groupDepartures } from '@/content/fixtures/group-departures.fixture';
import type { GroupDeparture } from '@/content/types';

// Same stub the legal-pages / Navbar suites use — this component only calls
// `useModal()` to wire its CTAs, it does not render the modal itself.
const openEnquiry = jest.fn();
const openBrochure = jest.fn();
jest.mock('@/components/modals/modal-context', () => ({
  useModal: () => ({ modal: null, openEnquiry, openBrochure, close: jest.fn() }),
}));

const bookable = groupDepartures.find((departure) => !departure.isSoldOut && !departure.durationUnverified)!;
const soldOut = groupDepartures.find((departure) => departure.isSoldOut)!;
const unverifiedDuration = groupDepartures.find((departure) => departure.durationUnverified)!;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GroupDepartureCard', () => {
  it('renders name, date range, duration, price and seats', () => {
    render(<GroupDepartureCard departure={bookable} />);

    expect(screen.getByRole('heading', { name: bookable.name })).toBeInTheDocument();
    expect(screen.getByText(bookable.dateRangeLabel)).toBeInTheDocument();
    expect(screen.getByText(bookable.durationLabel, { exact: false })).toBeInTheDocument();
    expect(screen.getByText(bookable.priceFrom)).toBeInTheDocument();
    expect(screen.getByText(bookable.seatsLabel)).toBeInTheDocument();
  });

  it('derives the "Ex {city}" boarding label from the FIRST boarding point only', () => {
    // Chardham Special boards from "Haridwar" alone; Do Dham boards from
    // "Ahmedabad · Delhi" — assert the multi-point case truncates to the first.
    const multiPoint = groupDepartures.find((departure) => departure.boardingPoints.includes('·'))!;
    expect(multiPoint.boardingPoints).toBe('Ahmedabad · Delhi');

    render(<GroupDepartureCard departure={multiPoint} />);

    expect(screen.getByText('Ex Ahmedabad')).toBeInTheDocument();
    expect(screen.queryByText(/Ex Ahmedabad · Delhi/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ex Delhi/)).not.toBeInTheDocument();
  });

  it('renders a single boarding point verbatim when there is only one', () => {
    const singlePoint = groupDepartures.find((departure) => !departure.boardingPoints.includes('·'))!;
    render(<GroupDepartureCard departure={singlePoint} />);

    expect(screen.getByText(`Ex ${singlePoint.boardingPoints}`)).toBeInTheDocument();
  });

  describe('the heart is an inert decoration (BLOCKERS.md Decision E)', () => {
    it('renders the heart glyph as an aria-hidden <span>, not a <button>', () => {
      const { container } = render(<GroupDepartureCard departure={bookable} />);

      // The heart is the second absolutely-positioned aria-hidden span in the
      // photo panel (the category pill is the first) — locate it by its path
      // data rather than by role, since it must NOT have an interactive role.
      const heartPath = container.querySelector('svg path[d^="M12 20s-7.5"]');
      expect(heartPath).toBeInTheDocument();

      const heartSpan = heartPath!.closest('span[aria-hidden="true"]');
      expect(heartSpan).toBeInTheDocument();
      expect(heartSpan!.tagName).toBe('SPAN');
    });

    it('exposes no button with a heart/favourite accessible name', () => {
      render(<GroupDepartureCard departure={bookable} />);

      expect(screen.queryByRole('button', { name: /favou?rite|wishlist|heart|save/i })).not.toBeInTheDocument();
    });
  });

  describe('durationUnverified marker', () => {
    it('renders the visible marker for a durationUnverified departure', () => {
      render(<GroupDepartureCard departure={unverifiedDuration} />);

      expect(screen.getByTestId(`group-duration-placeholder-${unverifiedDuration.slug}`)).toBeInTheDocument();
    });

    it('renders no marker for a departure whose duration is not flagged unverified', () => {
      render(<GroupDepartureCard departure={bookable} />);

      expect(screen.queryByTestId(`group-duration-placeholder-${bookable.slug}`)).not.toBeInTheDocument();
    });
  });

  describe('sold-out behaviour', () => {
    it('a sold-out departure renders the "This journey is currently full." notice', () => {
      render(<GroupDepartureCard departure={soldOut} />);

      expect(screen.getByText('This journey is currently full.')).toBeInTheDocument();
    });

    it('a sold-out departure does NOT render an enabled "Reserve a Seat" CTA', () => {
      render(<GroupDepartureCard departure={soldOut} />);

      expect(screen.queryByRole('button', { name: /Reserve a Seat/ })).not.toBeInTheDocument();
    });

    it('a bookable departure DOES render an enabled "Reserve a Seat" CTA and no sold-out notice', () => {
      render(<GroupDepartureCard departure={bookable} />);

      const reserveButton = screen.getByRole('button', { name: /Reserve a Seat/ });
      expect(reserveButton).toBeEnabled();
      expect(screen.queryByText('This journey is currently full.')).not.toBeInTheDocument();
    });

    it('always renders "Get Brochure", sold out or not', () => {
      render(<GroupDepartureCard departure={soldOut} />);
      expect(screen.getByRole('button', { name: /Get Brochure/ })).toBeEnabled();
    });
  });

  it('sanity: fixture actually provides both a sold-out and a bookable record to test against', () => {
    const record: GroupDeparture = soldOut;
    expect(record.isSoldOut).toBe(true);
    expect(bookable.isSoldOut).toBe(false);
  });
});

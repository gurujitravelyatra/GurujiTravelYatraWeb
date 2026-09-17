import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { GroupDepartureCard, GROUP_DURATION_NOTE_ID, GROUP_PRICE_NOTE_ID } from '../GroupDepartureCard';
import { groupDepartures } from '@/content/fixtures/group-departures.fixture';
import type { GroupDeparture } from '@/content/types';

// Same stub the legal-pages / Navbar suites use — this component only calls
// `useModal()` to wire its CTAs, it does not render the modal itself.
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

const bookable = groupDepartures.find((departure) => !departure.isSoldOut && !departure.durationUnverified)!;
const soldOut = groupDepartures.find((departure) => departure.isSoldOut)!;
const unverifiedDuration = groupDepartures.find((departure) => departure.durationUnverified)!;
const unverifiedPrice = groupDepartures.find((departure) => departure.priceUnverified)!;
const confirmedPrice = groupDepartures.find((departure) => !departure.priceUnverified)!;

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

    it('points the marked duration at the shared footnote id from a ROLED container', () => {
      // The role is the part that was missing: `aria-describedby` on an unroled
      // element is routinely ignored by assistive tech — see the same assertion
      // in `stats-single-source.test.tsx`.
      render(<GroupDepartureCard departure={unverifiedDuration} />);

      const group = screen.getByRole('group', { name: `Duration — ${unverifiedDuration.name}` });
      expect(group).toHaveAttribute('aria-describedby', GROUP_DURATION_NOTE_ID);
      expect(group).toHaveTextContent(unverifiedDuration.durationLabel);
    });
  });

  /**
   * BLOCKERS.md item 9. "Do Dham Yatra" carries the SAME unconfirmed ₹28,900
   * that `public-listing.ts` withholds from Home and `/tour-packages`, but the
   * gate is written against `Package` and never reached this sibling
   * `GroupDeparture` transcription — so the figure was suppressed on one
   * surface and published, unmarked, as this card's largest number on another.
   *
   * Asserted as the same three pieces the Home surfaces use, because any one
   * alone is worthless: a visible asterisk, a real footnote `id`, and an
   * `aria-describedby` on a roled container resolving to that id. (The footnote
   * element itself lives in `GroupDeparturesList` — one note for many cards —
   * so the id RESOLVING is asserted in that suite.)
   */
  describe('priceUnverified marker (BLOCKERS.md item 9)', () => {
    it('renders the visible marker on the price of a priceUnverified departure', () => {
      render(<GroupDepartureCard departure={unverifiedPrice} />);

      const marker = screen.getByTestId(`group-price-placeholder-${unverifiedPrice.slug}`);
      expect(marker).toBeVisible();
      expect(marker).toHaveTextContent('*');
      // Announced as the footnote via aria-describedby, never as a bare "*".
      expect(marker).toHaveAttribute('aria-hidden', 'true');
    });

    it('points the marked price at the shared footnote id from a ROLED container', () => {
      render(<GroupDepartureCard departure={unverifiedPrice} />);

      const group = screen.getByRole('group', { name: `Price per person — ${unverifiedPrice.name}` });
      expect(group).toHaveAttribute('aria-describedby', GROUP_PRICE_NOTE_ID);
      expect(group).toHaveTextContent(unverifiedPrice.priceFrom);
    });

    it('marks the price WITHOUT withholding the departure — the card still renders in full', () => {
      // Deliberately different from `Package.pricingUnverified`, which removes
      // the record entirely. That gate exists to stop a fabricated
      // "was ₹X / Save ₹Y" badge; this card renders no such badge.
      render(<GroupDepartureCard departure={unverifiedPrice} />);

      expect(screen.getByRole('heading', { name: unverifiedPrice.name })).toBeInTheDocument();
      expect(screen.getByText(unverifiedPrice.priceFrom)).toBeInTheDocument();
      expect(screen.getByText(unverifiedPrice.dateRangeLabel)).toBeInTheDocument();
      expect(screen.queryByText(/Save ₹/)).not.toBeInTheDocument();
      expect(screen.queryByText(/was ₹/i)).not.toBeInTheDocument();
    });

    it('renders NO price marker and no describedby for a departure with a confirmed price', () => {
      render(<GroupDepartureCard departure={confirmedPrice} />);

      expect(screen.queryByTestId(`group-price-placeholder-${confirmedPrice.slug}`)).not.toBeInTheDocument();
      expect(
        screen.queryByRole('group', { name: `Price per person — ${confirmedPrice.name}` })
      ).not.toBeInTheDocument();
      expect(screen.getByText(confirmedPrice.priceFrom)).toBeInTheDocument();
    });

    it('sanity: the fixture provides both a flagged and an unflagged price to test against', () => {
      expect(unverifiedPrice.name).toBe('Do Dham Yatra — Kedarnath & Badrinath');
      expect(unverifiedPrice.priceUnverified).toBe(true);
      expect(confirmedPrice.priceUnverified).toBeUndefined();
    });
  });

  /**
   * BLOCKERS.md item 0. "Reserve a Seat" used to call
   * `openEnquiry({ label: 'Group Tour', value: departure.name })`, sending the
   * departure NAME and nothing else — so the batch date that
   * `Group Tour Reservation – [Batch Date]` is built from was transmitted by
   * nothing on the site, and a seat request arrived indistinguishable from a
   * general enquiry about the same tour.
   */
  describe('"Reserve a Seat" submits a group-tour-reservation, not a generic enquiry', () => {
    it('passes the departure name AND its date range', async () => {
      const user = userEvent.setup();
      render(<GroupDepartureCard departure={bookable} />);

      await user.click(screen.getByRole('button', { name: /Reserve a Seat/ }));

      expect(openGroupReservation).toHaveBeenCalledTimes(1);
      expect(openGroupReservation).toHaveBeenCalledWith({
        departureName: bookable.name,
        batchDate: bookable.dateRangeLabel,
      });
    });

    it('no longer routes the reservation through the generic enquiry opener', async () => {
      const user = userEvent.setup();
      render(<GroupDepartureCard departure={bookable} />);

      await user.click(screen.getByRole('button', { name: /Reserve a Seat/ }));

      expect(openEnquiry).not.toHaveBeenCalled();
    });

    it('sanity: the fixture departure carries a real date range to send', () => {
      expect(bookable.dateRangeLabel).toBeTruthy();
      expect(bookable.dateRangeLabel).not.toBe(bookable.name);
    });

    /**
     * A brochure request is not a seat reservation — it stays a plain
     * `brochure` lead keyed on the tour, with no batch date.
     */
    it('"Get Brochure" still opens the brochure modal with the departure as context', async () => {
      const user = userEvent.setup();
      render(<GroupDepartureCard departure={bookable} />);

      await user.click(screen.getByRole('button', { name: /Get Brochure/ }));

      expect(openBrochure).toHaveBeenCalledWith({ label: 'Group Tour', value: bookable.name });
      expect(openGroupReservation).not.toHaveBeenCalled();
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

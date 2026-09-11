import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { GroupDeparturesList } from '../GroupDeparturesList';
import { departureMonths, groupDepartures } from '@/content/fixtures/group-departures.fixture';

jest.mock('@/components/modals/modal-context', () => ({
  useModal: () => ({ modal: null, openEnquiry: jest.fn(), openBrochure: jest.fn(), close: jest.fn() }),
}));

function renderList() {
  return render(<GroupDeparturesList departures={groupDepartures} months={departureMonths} />);
}

describe('GroupDeparturesList', () => {
  it('renders a month chip for every derived month, each with aria-pressed', () => {
    renderList();
    const group = screen.getByRole('group', { name: 'Filter by departure month' });

    for (const month of departureMonths) {
      const chip = within(group).getByRole('button', { name: `${month} 2026` });
      expect(chip).toHaveAttribute('aria-pressed', 'false');
    }
    expect(within(group).getByRole('button', { name: 'All Departures' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking a month chip filters the visible departures to that month', async () => {
    const user = userEvent.setup();
    renderList();

    const novDepartures = groupDepartures.filter((departure) => departure.month === 'Nov');
    expect(novDepartures.length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Nov 2026' }));

    expect(screen.getByRole('button', { name: 'Nov 2026' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All Departures' })).toHaveAttribute('aria-pressed', 'false');

    for (const departure of novDepartures) {
      expect(screen.getByRole('heading', { name: departure.name })).toBeInTheDocument();
    }
    const otherDepartures = groupDepartures.filter((departure) => departure.month !== 'Nov');
    for (const departure of otherDepartures) {
      expect(screen.queryByRole('heading', { name: departure.name })).not.toBeInTheDocument();
    }
  });

  it('clicking "All Departures" restores all four departures', async () => {
    const user = userEvent.setup();
    renderList();

    await user.click(screen.getByRole('button', { name: 'Jun 2026' }));
    await user.click(screen.getByRole('button', { name: 'All Departures' }));

    for (const departure of groupDepartures) {
      expect(screen.getByRole('heading', { name: departure.name })).toBeInTheDocument();
    }
  });

  it('updates the aria-live result count as the filter changes', async () => {
    const user = userEvent.setup();
    renderList();

    expect(screen.getByText(`${groupDepartures.length} departures found`)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Oct 2026' }));

    const octCount = groupDepartures.filter((departure) => departure.month === 'Oct').length;
    expect(screen.getByText(`${octCount} ${octCount === 1 ? 'departure' : 'departures'} found`)).toBeInTheDocument();
  });

  describe('unwired controls are genuinely inert', () => {
    it('the search input is disabled — structurally inert, not just styled to look so', () => {
      renderList();

      const search = screen.getByLabelText(/Search destination or tour/i);
      expect(search).toBeDisabled();
      expect(search).toHaveValue('');
    });

    it('the sort control is not a functional button — it carries no button role', () => {
      renderList();

      expect(screen.queryByRole('button', { name: /Earliest Departure/ })).not.toBeInTheDocument();
      const sortLabel = screen.getByText('Earliest Departure');
      const sortControl = sortLabel.closest('[aria-disabled="true"]');
      expect(sortControl).toBeInTheDocument();
      expect(sortControl!.tagName).not.toBe('BUTTON');
    });

    it('clicking where the sort control renders does not change the departure list', async () => {
      const user = userEvent.setup();
      renderList();

      const sortLabel = screen.getByText('Earliest Departure');
      await user.click(sortLabel);

      for (const departure of groupDepartures) {
        expect(screen.getByRole('heading', { name: departure.name })).toBeInTheDocument();
      }
    });
  });

  /**
   * BLOCKERS.md item 9 — the footnote half of the unconfirmed-price treatment.
   * `GroupDepartureCard` renders the asterisk and the `aria-describedby`; this
   * list renders exactly ONE note per kind for all the cards that need it, the
   * same "one shared note, many markers" contract as `StatsBar`/`WhyGtyBand`.
   *
   * What these tests are really guarding: that the reference RESOLVES. A marker
   * pointing at an id no element carries is the failure mode that leaves an
   * unconfirmed figure reading as settled fact for a screen-reader user.
   */
  describe('unverified-figure footnotes', () => {
    it('renders one price footnote, with a real id the card markers resolve to', () => {
      renderList();

      const flagged = groupDepartures.filter((departure) => departure.priceUnverified);
      expect(flagged.length).toBeGreaterThan(0);

      const note = screen.getByTestId('group-price-note');
      expect(note.tagName).toBe('P');
      expect(note.id).not.toBe('');
      expect(note).toHaveTextContent(/pending confirmation/i);
      expect(document.getElementById(note.id)).toBe(note);

      for (const departure of flagged) {
        const group = screen.getByRole('group', { name: `Price per person — ${departure.name}` });
        expect(document.getElementById(group.getAttribute('aria-describedby')!)).toBe(note);
        expect(screen.getByTestId(`group-price-placeholder-${departure.slug}`)).toBeVisible();
      }
    });

    it('renders the duration footnote the same way, and the two notes stay distinct', () => {
      renderList();

      const priceNote = screen.getByTestId('group-price-note');
      const durationNote = screen.getByTestId('group-duration-note');

      // Do Dham is flagged on BOTH counts — its two markers must point at two
      // different notes, or one of them describes the wrong figure.
      expect(priceNote.id).not.toBe(durationNote.id);
      expect(durationNote).toHaveTextContent(/duration/i);
      expect(priceNote).toHaveTextContent(/price/i);
    });

    it('drops the price footnote when the filter hides every flagged departure', async () => {
      const user = userEvent.setup();
      renderList();

      // Nov = "Kashi · Ayodhya · Prayagraj" — no unverified figures at all.
      const novFlagged = groupDepartures.filter(
        (departure) => departure.month === 'Nov' && (departure.priceUnverified || departure.durationUnverified)
      );
      expect(novFlagged).toHaveLength(0);

      await user.click(screen.getByRole('button', { name: 'Nov 2026' }));

      expect(screen.queryByTestId('group-price-note')).not.toBeInTheDocument();
      expect(screen.queryByTestId('group-duration-note')).not.toBeInTheDocument();
      expect(screen.queryByRole('group', { name: /^Price per person — / })).not.toBeInTheDocument();
    });

    it('every price marker on screen has a note to point at (no dangling reference)', () => {
      renderList();

      const markedGroups = screen.queryAllByRole('group', { name: /^Price per person — / });
      for (const group of markedGroups) {
        const id = group.getAttribute('aria-describedby');
        expect(id).toBeTruthy();
        expect(document.getElementById(id!)).toBeInTheDocument();
      }
    });
  });
});

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
});

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TripBuilder } from '../TripBuilder';
import { tripPlaceOptions } from '@/content/fixtures/places.fixture';

const openCustomTrip = jest.fn();
const openEnquiry = jest.fn();
jest.mock('@/components/modals/modal-context', () => ({
  useModal: () => ({
    modal: null,
    openEnquiry,
    openBrochure: jest.fn(),
    openGroupReservation: jest.fn(),
    openCustomTrip,
    close: jest.fn(),
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

const [placeA, placeB] = tripPlaceOptions;

function addPlace(name: string) {
  return screen.getByRole('button', { name: `Add ${name} to your trip` });
}

describe('TripBuilder interaction', () => {
  it('renders the empty state when no places are selected', () => {
    render(<TripBuilder placeOptions={tripPlaceOptions} />);

    expect(screen.getByText('No places added yet')).toBeInTheDocument();
    expect(screen.getByText('Empty Trip')).toBeInTheDocument();
  });

  it('adding a place puts it in the route with a default of 2 nights', async () => {
    const user = userEvent.setup();
    render(<TripBuilder placeOptions={tripPlaceOptions} />);

    await user.click(addPlace(placeA.name));

    expect(screen.getByText(`${placeA.region} · 2 nights`)).toBeInTheDocument();
    expect(screen.queryByText('No places added yet')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: `${placeA.name} added to your trip` })).toHaveAttribute('aria-pressed', 'true');
  });

  it('+ night increases the count, capped at 9', async () => {
    const user = userEvent.setup();
    render(<TripBuilder placeOptions={tripPlaceOptions} />);

    await user.click(addPlace(placeA.name));
    const moreButton = () => screen.getByRole('button', { name: `Add one night to ${placeA.name}` });

    // Starts at 2 nights; 7 clicks reaches the 9-night cap. Stop clicking once
    // the control disables itself rather than clicking a disabled button.
    for (let i = 0; i < 12 && !moreButton().hasAttribute('disabled'); i += 1) {
      await user.click(moreButton());
    }

    expect(screen.getByText(`${placeA.region} · 9 nights`)).toBeInTheDocument();
    expect(moreButton()).toBeDisabled();
  });

  it('− night decreases the count, floored at 1', async () => {
    const user = userEvent.setup();
    render(<TripBuilder placeOptions={tripPlaceOptions} />);

    await user.click(addPlace(placeA.name));
    const lessButton = () => screen.getByRole('button', { name: `Remove one night from ${placeA.name}` });

    // Starts at 2 nights; 1 click reaches the 1-night floor. Stop clicking
    // once the control disables itself rather than clicking a disabled button.
    for (let i = 0; i < 6 && !lessButton().hasAttribute('disabled'); i += 1) {
      await user.click(lessButton());
    }

    expect(screen.getByText(`${placeA.region} · 1 night`)).toBeInTheDocument();
    expect(lessButton()).toBeDisabled();
  });

  it('Remove removes a single place from the route, leaving the other intact', async () => {
    const user = userEvent.setup();
    render(<TripBuilder placeOptions={tripPlaceOptions} />);

    await user.click(addPlace(placeA.name));
    await user.click(addPlace(placeB.name));

    await user.click(screen.getByRole('button', { name: `Remove ${placeA.name} from your trip` }));

    // Scoped to the route step's own "Remove" affordance — the place still
    // appears in the picker grid regardless of trip membership, so asserting
    // on plain visible text would be a false negative.
    expect(screen.queryByRole('button', { name: `Remove ${placeA.name} from your trip` })).not.toBeInTheDocument();
    // The picker button's label reverts to "Add …" once removed from the trip.
    expect(screen.getByRole('button', { name: `Add ${placeA.name} to your trip` })).toHaveAttribute('aria-pressed', 'false');

    const remainingStop = screen.getByRole('button', { name: `Remove ${placeB.name} from your trip` }).closest('li')!;
    expect(within(remainingStop).getByText(`${placeB.region} · 2 nights`)).toBeInTheDocument();
  });

  it('Clear All empties the route and restores the empty state', async () => {
    const user = userEvent.setup();
    render(<TripBuilder placeOptions={tripPlaceOptions} />);

    await user.click(addPlace(placeA.name));
    await user.click(addPlace(placeB.name));
    expect(screen.getByRole('button', { name: 'Clear All' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Clear All' }));

    expect(screen.getByText('No places added yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear All' })).toBeDisabled();
  });
});

/**
 * Scoped to the summary card's own `<dl role="group" aria-label="Your trip
 * summary">`. Several of these labels are deliberately not unique on the page
 * — "Travel Month" is both the builder's `<select>` label and a summary row —
 * so an unscoped `getByText` matches two elements and throws. Scoping also
 * keeps the assertion honest: it proves the value reached the *summary*, not
 * merely that the string exists somewhere in the builder.
 */
function summaryRow(label: string) {
  const summary = screen.getByRole('group', { name: 'Your trip summary' });
  return within(summary).getByText(label).closest('div')!;
}

describe('TripBuilder — preferences flow into the summary card', () => {
  it('toggling a travel style chip updates aria-pressed and the summary "Travel Style" row', async () => {
    const user = userEvent.setup();
    render(<TripBuilder placeOptions={tripPlaceOptions} />);

    const styleGroup = screen.getByRole('group', { name: 'Travel style' });
    expect(within(styleGroup).getByRole('button', { name: 'Comfort' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(summaryRow('Travel Style')).getByText('Comfort')).toBeInTheDocument();

    await user.click(within(styleGroup).getByRole('button', { name: 'Luxury' }));

    expect(within(styleGroup).getByRole('button', { name: 'Luxury' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(styleGroup).getByRole('button', { name: 'Comfort' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(summaryRow('Travel Style')).getByText('Luxury')).toBeInTheDocument();
  });

  it('selecting a travel month updates the summary "Travel Month" row', async () => {
    const user = userEvent.setup();
    render(<TripBuilder placeOptions={tripPlaceOptions} />);

    expect(within(summaryRow('Travel Month')).getByText('Any month')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Travel Month'), 'November');

    expect(within(summaryRow('Travel Month')).getByText('November')).toBeInTheDocument();
  });

  it('changing traveller counts updates the summary "Travellers" row', async () => {
    const user = userEvent.setup();
    render(<TripBuilder placeOptions={tripPlaceOptions} />);

    expect(within(summaryRow('Travellers')).getByText('2 Adults')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Increase adults' }));
    expect(within(summaryRow('Travellers')).getByText('3 Adults')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Increase children' }));
    expect(within(summaryRow('Travellers')).getByText('3 Adults, 1 Child')).toBeInTheDocument();
  });
});

describe('TripBuilder — special-requests textarea', () => {
  it('caps at 500 characters (maxLength attribute) and its live counter updates', async () => {
    const user = userEvent.setup();
    render(<TripBuilder placeOptions={tripPlaceOptions} />);

    const textarea = screen.getByLabelText('Any special requests?');
    expect(textarea).toHaveAttribute('maxLength', '500');
    expect(screen.getByText('0/500')).toBeInTheDocument();

    await user.type(textarea, 'Hello world');

    expect(textarea).toHaveValue('Hello world');
    expect(screen.getByText('11/500')).toBeInTheDocument();
  });
});

/**
 * BLOCKERS.md item 0. `handleGetQuote` used to call
 * `openEnquiry({ label: 'Custom trip', value: routeSummary })` — it opened the
 * generic enquiry modal and DROPPED the entire trip. Nights per stop, travel
 * style, month, adults, children and notes reached no payload at all, and the
 * lead arrived tagged `Enquire Now – Rishikesh → Manali` rather than
 * `Custom Trip Request`.
 */
describe('TripBuilder — "Get My Custom Quote" carries the real trip', () => {
  it('passes every piece of builder state, including nights PER STOP', async () => {
    const user = userEvent.setup();
    render(<TripBuilder placeOptions={tripPlaceOptions} />);

    await user.click(addPlace(placeA.name));
    // placeA -> 3 nights (added at 2, +1), placeB stays at the default 2.
    await user.click(screen.getByRole('button', { name: `Add one night to ${placeA.name}` }));
    await user.click(addPlace(placeB.name));

    const styleGroup = screen.getByRole('group', { name: 'Travel style' });
    await user.click(within(styleGroup).getByRole('button', { name: 'Luxury' }));
    await user.selectOptions(screen.getByLabelText('Travel Month'), 'November');
    await user.click(screen.getByRole('button', { name: 'Increase adults' }));
    await user.click(screen.getByRole('button', { name: 'Increase children' }));
    await user.type(screen.getByLabelText('Any special requests?'), 'Ground floor rooms please.');

    await user.click(screen.getByRole('button', { name: 'Get My Custom Quote' }));

    expect(openCustomTrip).toHaveBeenCalledTimes(1);
    expect(openCustomTrip).toHaveBeenCalledWith({
      stops: [
        { slug: placeA.slug, name: placeA.name, region: placeA.region, nights: 3 },
        { slug: placeB.slug, name: placeB.name, region: placeB.region, nights: 2 },
      ],
      travelStyle: 'Luxury',
      travelMonth: 'November',
      adults: 3,
      childrenCount: 1,
      notes: 'Ground floor rooms please.',
    });
  });

  it('no longer routes a custom quote through the generic enquiry opener', async () => {
    const user = userEvent.setup();
    render(<TripBuilder placeOptions={tripPlaceOptions} />);

    await user.click(addPlace(placeA.name));
    await user.click(screen.getByRole('button', { name: 'Get My Custom Quote' }));

    expect(openEnquiry).not.toHaveBeenCalled();
  });

  /**
   * The button is not disabled on an empty route, and the server accepts an
   * empty `stops` array — "I want a custom trip but haven't picked anywhere
   * yet" is a real lead.
   */
  it('still submits on an empty route, with the untouched defaults', async () => {
    const user = userEvent.setup();
    render(<TripBuilder placeOptions={tripPlaceOptions} />);

    await user.click(screen.getByRole('button', { name: 'Get My Custom Quote' }));

    expect(openCustomTrip).toHaveBeenCalledWith({
      stops: [],
      travelStyle: 'Comfort',
      // Never chosen -> absent, rather than a guessed month or the literal
      // display string "Any month".
      travelMonth: undefined,
      adults: 2,
      childrenCount: 0,
      notes: undefined,
    });
  });

  it('sends no budget — the builder has no budget input to read one from', async () => {
    const user = userEvent.setup();
    render(<TripBuilder placeOptions={tripPlaceOptions} />);

    await user.click(addPlace(placeA.name));
    await user.click(screen.getByRole('button', { name: 'Get My Custom Quote' }));

    expect(openCustomTrip.mock.calls[0][0]).not.toHaveProperty('budget');
  });
});

describe('TripBuilder — Budget control and step-4 preference chips are inert', () => {
  it('marks the Budget (Per Person) field aria-disabled with a visible "coming soon"', () => {
    render(<TripBuilder placeOptions={tripPlaceOptions} />);

    const budgetField = screen.getByTestId('ct-budget-field');
    expect(budgetField).toHaveAttribute('aria-disabled', 'true');
    expect(budgetField).toHaveTextContent(/coming soon/i);
  });

  it('renders all four step-4 preference chips disabled', () => {
    render(<TripBuilder placeOptions={tripPlaceOptions} />);

    const group = screen.getByRole('group', { name: 'Additional preferences (coming soon)' });
    const chipLabels = ['Hotel Type', 'Food Preference', 'Vehicle Type', 'Special Requests'];

    for (const label of chipLabels) {
      const chip = within(group).getByRole('button', { name: `${label} — coming soon` });
      expect(chip).toBeDisabled();
    }
  });
});

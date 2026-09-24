import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { TourFormState } from '@/app/admin/tours/form-state';
import type { TourFormValues } from '@/server/admin/tours/tour-form-schema';

/**
 * The "Batch departures" section of the tour editor — a real React render, typed
 * into and submitted, with the payload read back from the action call.
 *
 * Same harness as `TourForm-conflict.test.tsx`: the server action is mocked, and
 * the assertion is on the `FormData` the form actually dispatched, because that
 * is what the server re-validates and saves.
 */

const mockSaveTourAction = jest.fn<Promise<TourFormState>, [TourFormState, FormData]>();

jest.mock('@/app/admin/tours/actions', () => ({
  saveTourAction: (state: TourFormState, formData: FormData) => mockSaveTourAction(state, formData),
}));

import { TourForm } from '../TourForm';

const SEEDED_BATCH = {
  slug: 'spiti-valley-circuit',
  name: 'Spiti Valley Circuit',
  startDate: '2026-10-06',
  endDate: '2026-10-15',
  seatsAvailable: '8',
  priceFrom: '₹42,500',
  durationLabel: '9N / 10D',
  boardingPoints: 'Delhi',
  tourManagerLabel: 'Yes, GTY manager',
};

function loaded(overrides: Partial<TourFormValues> = {}): TourFormValues {
  return {
    name: 'Spiti Valley Circuit',
    slug: 'spiti-valley-circuit',
    destinationSlug: 'spiti-valley',
    category: 'Adventure',
    audienceTags: [],
    durationLabel: '9 Days 8 Nights',
    shortDescription: 'A description.',
    priceFrom: '₹42,500',
    isHot: false,
    inclusions: [],
    exclusions: [],
    itineraryDays: [],
    faqs: [],
    pricingTiers: [],
    galleryImages: [],
    departures: [],
    ...overrides,
  };
}

const ASYNC = { timeout: 10_000 };

function renderEditor(values: TourFormValues, extra: Partial<Parameters<typeof TourForm>[0]> = {}) {
  return render(
    <TourForm
      destinations={[{ slug: 'spiti-valley', name: 'Spiti Valley' }]}
      editingSlug="spiti-valley-circuit"
      defaultValues={values}
      versionToken="2026-09-25T10:00:00.000Z"
      departureVisibility="LISTED"
      {...extra}
    />
  );
}

async function submittedPayload(): Promise<TourFormValues> {
  await waitFor(() => expect(mockSaveTourAction).toHaveBeenCalledTimes(1), ASYNC);
  return JSON.parse(String(mockSaveTourAction.mock.calls[0][1].get('payload'))) as TourFormValues;
}

beforeEach(() => {
  mockSaveTourAction.mockReset();
  mockSaveTourAction.mockResolvedValue({ error: null, fieldErrors: {} });
});

describe('when the section is shown', () => {
  it('is absent for a tour that is not a Group Tour and has no batches', () => {
    renderEditor(loaded());
    expect(screen.queryByTestId('tour-departures-section')).not.toBeInTheDocument();
  });

  it('appears as soon as "Group Tour" is ticked', async () => {
    const user = userEvent.setup();
    renderEditor(loaded());
    await user.click(screen.getByRole('checkbox', { name: 'Group Tour' }));
    expect(screen.getByTestId('tour-departures-section')).toBeInTheDocument();
  });

  it('is shown for a tour that HAS batches even when it is not tagged — so they are never public and uneditable', () => {
    renderEditor(loaded({ departures: [SEEDED_BATCH] }));
    const section = screen.getByTestId('tour-departures-section');
    expect(within(section).getByText(/not tagged “Group Tour”, but it has batches/)).toBeInTheDocument();
  });

  it('states whether the batches are on /group-tours, from the value the server resolved', () => {
    renderEditor(loaded({ audienceTags: ['Group Tour'] }), { departureVisibility: 'ARCHIVED' });
    expect(screen.getByTestId('tour-departures-visibility')).toHaveTextContent(/archived, so the batches below are NOT on \/group-tours/);
  });
});

describe('editing batches', () => {
  it('loads a stored batch and previews exactly what the card will say', () => {
    renderEditor(loaded({ departures: [SEEDED_BATCH] }));
    expect(screen.getByLabelText('Departs')).toHaveValue('2026-10-06');
    expect(screen.getByLabelText('Seats available')).toHaveValue(8);
    expect(screen.getByTestId('departure-batch-0-preview')).toHaveTextContent('06 — 15 Oct 2026 · 08 seats left');
  });

  it('shows the stored batch’s safety markers read-only, and the tour’s price doubt on every batch', () => {
    renderEditor(loaded({ departures: [SEEDED_BATCH] }), {
      departureMarkers: { 'spiti-valley-circuit': { durationUnverified: true, priceUnverified: false } },
      tourPricingUnverified: true,
    });
    const markers = screen.getByTestId('departure-batch-0-markers');
    expect(markers).toHaveTextContent('Duration pending confirmation');
    expect(markers).toHaveTextContent('Price pending confirmation');
    // Read-only: there is no control that could clear either flag.
    expect(within(markers).queryByRole('button')).not.toBeInTheDocument();
    expect(within(markers).queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('submits an edited seat count and keeps the batch identity', async () => {
    const user = userEvent.setup();
    renderEditor(loaded({ departures: [SEEDED_BATCH] }));

    const seats = screen.getByLabelText('Seats available');
    await user.clear(seats);
    await user.type(seats, '0');
    expect(screen.getByTestId('departure-batch-0-preview')).toHaveTextContent('06 — 15 Oct 2026 · Sold out');

    await user.click(screen.getByRole('button', { name: 'Save as Draft' }));
    const payload = await submittedPayload();
    expect(payload.departures).toEqual([{ ...SEEDED_BATCH, seatsAvailable: '0' }]);
  });

  it('adds a batch pre-titled with the tour name, and submits it without an identity', async () => {
    const user = userEvent.setup();
    renderEditor(loaded({ audienceTags: ['Group Tour'] }));

    await user.click(screen.getByRole('button', { name: '+ Add batch' }));
    expect(screen.getByLabelText('Batch title')).toHaveValue('Spiti Valley Circuit');

    await user.type(screen.getByLabelText('Departs'), '2027-01-04');
    await user.type(screen.getByLabelText('Returns'), '2027-01-10');
    await user.type(screen.getByLabelText('Seats available'), '20');
    await user.click(screen.getByLabelText('Price'));
    await user.paste('₹39,900');
    await user.type(screen.getByLabelText('Duration'), '6N / 7D');
    await user.type(screen.getByLabelText('Boarding points'), 'Delhi');
    await user.type(screen.getByLabelText('Tour manager'), 'Yes, GTY manager');

    await user.click(screen.getByRole('button', { name: 'Save as Draft' }));
    const payload = await submittedPayload();
    expect(payload.departures).toHaveLength(1);
    expect(payload.departures?.[0]).toMatchObject({ name: 'Spiti Valley Circuit', startDate: '2027-01-04', seatsAvailable: '20' });
    expect(payload.departures?.[0]).not.toHaveProperty('slug');
  });

  it('removes a batch, and the submission no longer carries it', async () => {
    const user = userEvent.setup();
    renderEditor(loaded({ audienceTags: ['Group Tour'], departures: [SEEDED_BATCH] }));

    await user.click(screen.getByRole('button', { name: 'Remove batch 1' }));
    await user.click(screen.getByRole('button', { name: 'Save as Draft' }));
    const payload = await submittedPayload();
    expect(payload.departures).toEqual([]);
  });

  it('refuses a return date before the departure date, in place, and posts nothing', async () => {
    const user = userEvent.setup();
    renderEditor(loaded({ departures: [{ ...SEEDED_BATCH, endDate: '2026-10-01' }] }));

    await user.click(screen.getByRole('button', { name: 'Save as Draft' }));
    expect(await screen.findByText('The return date must be on or after the departure date.', {}, ASYNC)).toBeInTheDocument();
    expect(mockSaveTourAction).not.toHaveBeenCalled();
  });
});

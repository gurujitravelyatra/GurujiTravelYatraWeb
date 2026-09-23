import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { TourFormState } from '@/app/admin/tours/form-state';
import type { TourFormValues } from '@/server/admin/tours/tour-form-schema';

/**
 * M7 — a refused concurrent edit must NOT cost the admin what they typed.
 *
 * Not assumable, and worth a real render: React 19 automatically RESETS a
 * `<form action={fn}>` after the action settles, and React Hook Form's inputs
 * are uncontrolled. So "the action returned state instead of redirecting" is
 * necessary but not sufficient — the DOM could still snap back to the loaded
 * values while RHF's internal state keeps the typed ones, which is worse than
 * either: the admin sees their edit vanish, and a later save sends it anyway.
 */

const mockSaveTourAction = jest.fn<Promise<TourFormState>, [TourFormState, FormData]>();

jest.mock('@/app/admin/tours/actions', () => ({
  saveTourAction: (state: TourFormState, formData: FormData) => mockSaveTourAction(state, formData),
}));

import { TourForm } from '../TourForm';

const LOADED: TourFormValues = {
  name: 'Spiti Valley Circuit',
  slug: 'spiti-valley-circuit',
  destinationSlug: 'spiti-valley',
  category: 'Adventure',
  audienceTags: [],
  durationLabel: '9 Days 8 Nights',
  shortDescription: 'The loaded description.',
  priceFrom: '₹42,500',
  isHot: false,
  inclusions: [],
  exclusions: [],
  itineraryDays: [],
  faqs: [],
  pricingTiers: [],
  galleryImages: [],
};

const VERSION = '2026-09-19T10:00:00.000Z';

/**
 * The resolver + transition round trip on a ~40-field form takes well over
 * Testing Library's 1s default under full-suite load (measured: it timed out at
 * 4 workers). The budget is for slowness, not for flakiness in the behaviour.
 */
const ASYNC = { timeout: 10_000 };

function renderEditor() {
  return render(
    <TourForm
      destinations={[{ slug: 'spiti-valley', name: 'Spiti Valley' }]}
      editingSlug="spiti-valley-circuit"
      defaultValues={LOADED}
      versionToken={VERSION}
    />
  );
}

beforeEach(() => {
  mockSaveTourAction.mockReset();
  mockSaveTourAction.mockResolvedValue({
    error: 'Someone else saved changes to this tour after you opened it, so your changes have NOT been saved.',
    fieldErrors: {},
    conflict: true,
  });
});

it('posts the version the editor was loaded at', async () => {
  const user = userEvent.setup();
  renderEditor();

  await user.click(screen.getByRole('button', { name: 'Save as Draft' }));

  await waitFor(() => expect(mockSaveTourAction).toHaveBeenCalledTimes(1), ASYNC);
  const formData = mockSaveTourAction.mock.calls[0][1];
  expect(formData.get('expectedUpdatedAt')).toBe(VERSION);
  expect(formData.get('editingSlug')).toBe('spiti-valley-circuit');
});

it('keeps everything the admin typed on screen after a conflict, and offers a reload link', async () => {
  const user = userEvent.setup();
  renderEditor();

  const name = screen.getByLabelText(/^Tour name/);
  const description = screen.getByLabelText(/^Short description/);
  // `paste` rather than `type`: one input event instead of one per character
  // across a ~40-field RHF form, which kept this test near the 30s timeout under
  // full-suite load. The reset being tested is indifferent to how the text got there.
  await user.clear(name);
  await user.click(name);
  await user.paste('My unsaved title');
  await user.clear(description);
  await user.click(description);
  await user.paste('My unsaved description.');

  await user.click(screen.getByRole('button', { name: 'Save as Draft' }));

  const alert = await screen.findByText(/someone else saved changes/i, {}, ASYNC);
  expect(alert).toBeInTheDocument();

  // THE assertion: the DOM still shows the admin's text, not the loaded values.
  expect(screen.getByLabelText(/^Tour name/)).toHaveValue('My unsaved title');
  expect(screen.getByLabelText(/^Short description/)).toHaveValue('My unsaved description.');

  // And what was POSTED was the typed text too — the payload is not stale.
  const payload = JSON.parse(String(mockSaveTourAction.mock.calls[0][1].get('payload'))) as TourFormValues;
  expect(payload.name).toBe('My unsaved title');

  const reload = screen.getByRole('link', { name: /reload to see their version/i });
  expect(reload).toHaveAttribute('href', '/admin/tours/spiti-valley-circuit/edit');
});

it('shows no reload link for an ordinary (non-conflict) error', async () => {
  mockSaveTourAction.mockResolvedValue({ error: 'Saving failed. The tour has not been changed.', fieldErrors: {} });
  const user = userEvent.setup();
  renderEditor();

  await user.click(screen.getByRole('button', { name: 'Save as Draft' }));

  await screen.findByText(/saving failed/i, {}, ASYNC);
  expect(screen.queryByRole('link', { name: /reload to see their version/i })).toBeNull();
});

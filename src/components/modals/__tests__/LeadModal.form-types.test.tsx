import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LeadModal } from '../LeadModal';
import type { LeadDetails } from '../lead-details';
import { leadSubmissionSchema } from '@/server/leads/lead-schema';

/**
 * The full client path for the two `formType`s that previously had NO producer
 * at all (BLOCKERS.md item 0): fill the modal, submit, and read the JSON that
 * actually left the browser.
 *
 * `fetch` is mocked here rather than the API client, deliberately. The other
 * modal suites stub `submitLeadRequest` because they are about step
 * transitions; this one is about the wire, so it asserts on the serialised
 * body — which is the only thing the server ever sees, and the only artefact
 * that can prove the trip/batch date really left the page.
 */

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ data: { received: true, leadId: 'lead-1' } }),
  });
  global.fetch = fetchMock as unknown as typeof fetch;
});

async function submitModal(details: LeadDetails, context: { label: string; value: string }) {
  const user = userEvent.setup();
  render(<LeadModal variant="enquiry" open context={context} details={details} onClose={jest.fn()} />);

  await user.type(screen.getByLabelText('Name *'), 'Asha Patel');
  await user.type(screen.getByLabelText('Mobile Number *'), '9876543210');
  await user.click(screen.getByRole('button', { name: /Start Your Journey/ }));

  await screen.findByText(/Your journey/);
  return sentBody();
}

/** The request body as the route receives it — parsed back out of the fetch call. */
function sentBody(): Record<string, unknown> {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/leads');
  expect(init.method).toBe('POST');
  return JSON.parse(init.body);
}

describe('LeadModal — group-tour-reservation', () => {
  const details: LeadDetails = {
    formType: 'group-tour-reservation',
    batchDate: '12 — 18 May 2026',
    departureName: 'Spiti Valley Circuit',
  };

  it('POSTs the batch date that the old name-only enquiry payload never carried', async () => {
    const body = await submitModal(details, { label: 'Group Tour', value: 'Spiti Valley Circuit' });

    expect(body).toMatchObject({
      formType: 'group-tour-reservation',
      batchDate: '12 — 18 May 2026',
      departureName: 'Spiti Valley Circuit',
      name: 'Asha Patel',
      mobile: '9876543210',
    });
  });

  it('sends a body the real server schema accepts', async () => {
    const body = await submitModal(details, { label: 'Group Tour', value: 'Spiti Valley Circuit' });

    expect(leadSubmissionSchema.safeParse(body).success).toBe(true);
  });

  it('still shows the departure in the context chip, so the UX is unchanged', () => {
    render(
      <LeadModal
        variant="enquiry"
        open
        context={{ label: 'Group Tour', value: 'Spiti Valley Circuit' }}
        details={details}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText('Enquiring about')).toBeInTheDocument();
    expect(screen.getByText('Spiti Valley Circuit')).toBeInTheDocument();
    expect(screen.getByText('· pre-filled from this page')).toBeInTheDocument();
  });
});

describe('LeadModal — custom-trip', () => {
  const details: LeadDetails = {
    formType: 'custom-trip',
    stops: [
      { slug: 'rishikesh', name: 'Rishikesh', region: 'Uttarakhand', nights: 3 },
      { slug: 'manali', name: 'Manali', region: 'Himachal', nights: 2 },
    ],
    travelStyle: 'Luxury',
    travelMonth: 'November',
    adults: 3,
    childrenCount: 1,
    notes: 'Ground floor rooms please.',
  };

  const context = { label: 'Custom trip', value: 'Rishikesh → Manali' };

  it('POSTs the whole trip — nights per stop included — not just the route string', async () => {
    const body = await submitModal(details, context);

    expect(body).toMatchObject({
      formType: 'custom-trip',
      stops: [
        { slug: 'rishikesh', name: 'Rishikesh', region: 'Uttarakhand', nights: 3 },
        { slug: 'manali', name: 'Manali', region: 'Himachal', nights: 2 },
      ],
      travelStyle: 'Luxury',
      travelMonth: 'November',
      adults: 3,
      childrenCount: 1,
      notes: 'Ground floor rooms please.',
    });
  });

  it('sends a body the real server schema accepts', async () => {
    const body = await submitModal(details, context);

    expect(leadSubmissionSchema.safeParse(body).success).toBe(true);
  });

  it('sends no budget — the trip builder collects none', async () => {
    const body = await submitModal(details, context);

    expect(body).not.toHaveProperty('budget');
  });

  it('is NOT tagged as a generic enquiry, which is what it used to collapse into', async () => {
    const body = await submitModal(details, context);

    expect(body.formType).not.toBe('enquiry');
    expect(body).not.toHaveProperty('pageName');
  });
});

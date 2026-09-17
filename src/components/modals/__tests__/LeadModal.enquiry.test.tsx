import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LeadModal } from '../LeadModal';
import { submitLeadRequest } from '@/lib/leads/lead-api-client';
import type { LeadApiResult } from '@/lib/leads/lead-api-client';

// The transport is covered on its own in
// `src/lib/leads/__tests__/lead-api-client.test.ts`; these specs are about what
// the modal DOES with each outcome, so the client is stubbed rather than fetch.
jest.mock('@/lib/leads/lead-api-client', () => ({
  ...jest.requireActual('@/lib/leads/lead-api-client'),
  submitLeadRequest: jest.fn(),
}));

const submitLead = submitLeadRequest as jest.Mock;

const context = { label: 'Package', value: 'Spiti Valley Circuit' };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Name *'), 'Asha Patel');
  await user.type(screen.getByLabelText('Mobile Number *'), '9876543210');
}

describe('LeadModal variant="enquiry"', () => {
  beforeEach(() => {
    submitLead.mockReset();
  });

  it('blocks submit when Name/Mobile are missing', async () => {
    const user = userEvent.setup();
    render(<LeadModal variant="enquiry" open context={context} onClose={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: /Start Your Journey/ }));

    expect(await screen.findByText('Please enter your full name.')).toBeInTheDocument();
    expect(screen.getByText('Please enter your mobile number.')).toBeInTheDocument();
    expect(submitLead).not.toHaveBeenCalled();
  });

  it('does not block submit when only the optional fields are empty', async () => {
    const user = userEvent.setup();
    const { promise } = deferred<LeadApiResult>();
    submitLead.mockReturnValue(promise);

    render(<LeadModal variant="enquiry" open context={context} onClose={jest.fn()} />);
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /Start Your Journey/ }));

    expect(submitLead).toHaveBeenCalledTimes(1);
    expect(submitLead).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Asha Patel', mobile: '9876543210', email: undefined })
    );
  });

  /**
   * A plain enquiry needs no `details` prop — `variant` + `context` already say
   * everything the payload needs, and every existing trigger (`openEnquiry`)
   * passes nothing more. This pins that default so the Navbar/hero/about CTAs
   * cannot silently start submitting an untagged lead.
   */
  it('defaults to formType "enquiry" and derives pageName from the context chip', async () => {
    const user = userEvent.setup();
    submitLead.mockResolvedValue({ status: 'success', leadId: 'lead-1' });

    render(<LeadModal variant="enquiry" open context={context} onClose={jest.fn()} />);
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /Start Your Journey/ }));

    expect(submitLead.mock.calls[0][0]).toMatchObject({
      formType: 'enquiry',
      pageName: 'Spiti Valley Circuit',
      interestedIn: 'Spiti Valley Circuit',
    });
  });

  it('a contextless enquiry sends no pageName rather than inventing one', async () => {
    const user = userEvent.setup();
    submitLead.mockResolvedValue({ status: 'success', leadId: 'lead-1' });

    // The Navbar's persistent "Enquire Now" calls `openEnquiry()` with no args.
    render(<LeadModal variant="enquiry" open onClose={jest.fn()} />);
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /Start Your Journey/ }));

    const request = submitLead.mock.calls[0][0];
    expect(request).toMatchObject({ formType: 'enquiry' });
    expect(request.pageName).toBeUndefined();
    expect(request.interestedIn).toBeUndefined();
  });

  it('transitions form -> sending -> form-with-error, and the error path preserves every entered value', async () => {
    const user = userEvent.setup();
    const { promise, resolve } = deferred<LeadApiResult>();
    submitLead.mockReturnValue(promise);

    render(<LeadModal variant="enquiry" open context={context} onClose={jest.fn()} />);
    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('City'), 'Ahmedabad');
    await user.click(screen.getByRole('button', { name: /Start Your Journey/ }));

    // "sending" step
    expect(await screen.findByText('Submitting your enquiry…')).toBeInTheDocument();

    await act(async () => {
      resolve({ status: 'error', message: 'Visitor safe message.' });
    });

    // Back on the form step, with the error banner and every entered value intact.
    expect(await screen.findByRole('alert')).toHaveTextContent('Visitor safe message.');
    expect(screen.getByLabelText('Name *')).toHaveValue('Asha Patel');
    expect(screen.getByLabelText('Mobile Number *')).toHaveValue('9876543210');
    expect(screen.getByLabelText('City')).toHaveValue('Ahmedabad');
  });

  it('"Try Again" re-submits with the same preserved values', async () => {
    const user = userEvent.setup();
    submitLead.mockResolvedValue({ status: 'error', message: 'Visitor safe message.' });

    render(<LeadModal variant="enquiry" open context={context} onClose={jest.fn()} />);
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /Start Your Journey/ }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(submitLead).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(submitLead).toHaveBeenCalledTimes(2);
    expect(submitLead.mock.calls[1][0]).toEqual(expect.objectContaining({ name: 'Asha Patel', mobile: '9876543210' }));
  });

  /**
   * The route's 200 carries no visitor-facing copy (only `leadId`/`source`/
   * `receivedAt`), so the confirmation sentence is composed from the context
   * the client already has rather than from a server string.
   */
  it('transitions form -> sending -> done on a successful submission', async () => {
    const user = userEvent.setup();
    submitLead.mockResolvedValue({ status: 'success', leadId: 'lead-42' });

    render(<LeadModal variant="enquiry" open context={context} onClose={jest.fn()} />);
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /Start Your Journey/ }));

    expect(
      await screen.findByText("We've got it — GTY will call you about Spiti Valley Circuit within business hours.")
    ).toBeInTheDocument();
    expect(screen.getByText(/Your journey/)).toBeInTheDocument();
  });

  // The submit path is now real (`POST /api/leads`), but that route validates
  // and LOGS — there is still no CRM behind it, no rate limiter and no
  // encryption. Copy claiming otherwise is a false statement to the visitor,
  // not a cosmetic issue.
  describe('claims no capability the submit path does not have', () => {
    const FALSE_CLAIMS = [/server-side/i, /rate.?limit/i, /\bCRM\b/, /encrypted/i];

    it('makes no such claim on the form step', () => {
      const { container } = render(<LeadModal variant="enquiry" open context={context} onClose={jest.fn()} />);

      expect(screen.getByText(/We'll only use these details to plan your journey with you\./)).toBeInTheDocument();
      for (const claim of FALSE_CLAIMS) {
        expect(container.textContent ?? '').not.toMatch(claim);
      }
    });

    /**
     * L4: the pre-submit disclaimer promised "our team will review your
     * enquiry and get back to you shortly" on a path that cannot succeed —
     * nothing is transmitted or stored, so no review can follow. The form step
     * may describe what the details are FOR, never what will happen next.
     */
    it('promises no follow-up before anything has been submitted', () => {
      const { container } = render(<LeadModal variant="enquiry" open context={context} onClose={jest.fn()} />);
      const text = container.textContent ?? '';

      expect(text).not.toMatch(/will review your (enquiry|request)/i);
      expect(text).not.toMatch(/get back to you shortly/i);
      expect(text).not.toMatch(/we('ll| will) (call|contact|email) you/i);
    });

    it('makes no such claim on the sending step', async () => {
      const user = userEvent.setup();
      const { promise } = deferred<LeadApiResult>();
      submitLead.mockReturnValue(promise);

      const { container } = render(<LeadModal variant="enquiry" open context={context} onClose={jest.fn()} />);
      await fillRequiredFields(user);
      await user.click(screen.getByRole('button', { name: /Start Your Journey/ }));

      expect(await screen.findByText('Submitting your enquiry…')).toBeInTheDocument();
      for (const claim of FALSE_CLAIMS) {
        expect(container.textContent ?? '').not.toMatch(claim);
      }
    });
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LeadModal } from '../LeadModal';
import { submitLeadRequest } from '@/lib/leads/lead-api-client';

jest.mock('@/lib/leads/lead-api-client', () => ({
  ...jest.requireActual('@/lib/leads/lead-api-client'),
  submitLeadRequest: jest.fn(),
}));

// CRM-migration Step 3: never load the real Cloudflare script in a test —
// see `src/components/modals/__mocks__/TurnstileWidget.tsx`'s own header.
jest.mock('../TurnstileWidget');

const submitLead = submitLeadRequest as jest.Mock;

const context = { label: 'Package', value: 'Spiti Valley Circuit' };

/**
 * `POST /api/leads` answers a bad submission with
 * `{ error, fields: { 'field.path': [messages] } }`, and the whole point of
 * building `fields` from `error.issues` server-side (rather than Zod's
 * `flatten()`) was so the modal could put each message next to the input that
 * caused it. This suite is what makes that true on the client.
 *
 * The bar it enforces: a server rule and a client rule must be
 * INDISTINGUISHABLE to the visitor. No second error UI, no "some fields are
 * invalid" dead end — the same `Field`/`error` slot the client-side Zod
 * resolver already renders into.
 */

async function submitWith(result: unknown, options: { variant?: 'enquiry' | 'brochure' } = {}) {
  const user = userEvent.setup();
  submitLead.mockResolvedValue(result);

  render(<LeadModal variant={options.variant ?? 'enquiry'} open context={context} onClose={jest.fn()} />);
  await user.type(screen.getByLabelText('Name *'), 'Asha Patel');
  await user.type(screen.getByLabelText('Mobile Number *'), '9876543210');
  await user.click(screen.getByLabelText(/I agree to be contacted/));
  await user.click(screen.getByRole('button', { name: /Start Your Journey/ }));

  return user;
}

beforeEach(() => {
  submitLead.mockReset();
});

describe('LeadModal — field-level 400s', () => {
  it('renders a server field error on the field itself, wired to it by aria-describedby', async () => {
    await submitWith({
      status: 'error',
      message: 'Some details need fixing before we can send this.',
      fields: { mobile: ['Please enter a valid mobile number.'] },
    });

    const message = await screen.findByText('Please enter a valid mobile number.');
    expect(message).toBeInTheDocument();

    // Same wiring the client-side resolver produces — not a parallel mechanism.
    const mobileInput = screen.getByLabelText('Mobile Number *');
    expect(mobileInput).toHaveAttribute('aria-describedby', message.getAttribute('id'));
    expect(mobileInput).toHaveAttribute('aria-invalid', 'true');
  });

  it('places several field errors on their own separate fields', async () => {
    await submitWith({
      status: 'error',
      message: 'Some details need fixing before we can send this.',
      fields: {
        name: ['Please enter a shorter name.'],
        email: ['Please enter a valid email address.'],
        city: ['Please keep this under 120 characters.'],
      },
    });

    expect(await screen.findByText('Please enter a shorter name.')).toBeInTheDocument();
    expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Please keep this under 120 characters.')).toBeInTheDocument();
  });

  it('keeps every value the visitor typed — a 400 must never cost them the form', async () => {
    const user = userEvent.setup();
    submitLead.mockResolvedValue({
      status: 'error',
      message: 'Some details need fixing before we can send this.',
      fields: { city: ['Please keep this under 120 characters.'] },
    });

    render(<LeadModal variant="enquiry" open context={context} onClose={jest.fn()} />);
    await user.type(screen.getByLabelText('Name *'), 'Asha Patel');
    await user.type(screen.getByLabelText('Mobile Number *'), '9876543210');
    await user.type(screen.getByLabelText('City'), 'Ahmedabad');
    await user.click(screen.getByLabelText(/I agree to be contacted/));
    await user.click(screen.getByRole('button', { name: /Start Your Journey/ }));

    expect(await screen.findByText('Please keep this under 120 characters.')).toBeInTheDocument();
    expect(screen.getByLabelText('Name *')).toHaveValue('Asha Patel');
    expect(screen.getByLabelText('Mobile Number *')).toHaveValue('9876543210');
    expect(screen.getByLabelText('City')).toHaveValue('Ahmedabad');
  });

  it('shows the form-level banner alongside the inline errors, with a working retry', async () => {
    await submitWith({
      status: 'error',
      message: 'Some details need fixing before we can send this.',
      fields: { mobile: ['Please enter a valid mobile number.'] },
    });

    const banner = await screen.findByTestId('lead-form-error');
    expect(banner).toHaveTextContent('Some details need fixing before we can send this.');
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
  });

  /**
   * The failure mode this guards against is a form that cannot be submitted and
   * will not say why. `sourcePageUrl`, `batchDate`, `stops.0.nights` and
   * `utm.source` are all real 400 paths with no input behind them, so their
   * messages have nowhere inline to go — they must surface in the banner
   * rather than being dropped on the floor.
   */
  it.each([
    ['batchDate', 'A departure date is required.'],
    ['sourcePageUrl', 'A valid page URL is required.'],
    ['stops.0.nights', 'Number must be less than or equal to 9'],
    ['utm.source', 'Please keep this under 200 characters.'],
  ])('surfaces the un-attachable field error %s in the banner instead of discarding it', async (path, message) => {
    await submitWith({
      status: 'error',
      message: 'Some details need fixing before we can send this.',
      fields: { [path]: [message] },
    });

    const banner = await screen.findByTestId('lead-form-error');
    expect(banner).toHaveTextContent('Some details need fixing before we can send this.');
    expect(banner).toHaveTextContent(message);
  });

  it('clears a server error once the visitor corrects that field and resubmits', async () => {
    const user = await submitWith({
      status: 'error',
      message: 'Some details need fixing before we can send this.',
      fields: { mobile: ['Please enter a valid mobile number.'] },
    });

    expect(await screen.findByText('Please enter a valid mobile number.')).toBeInTheDocument();

    submitLead.mockResolvedValue({ status: 'success', leadId: 'lead-1' });
    await user.click(screen.getByRole('button', { name: 'Try Again' }));

    // Reached the done step, so the stale server error is gone with the form.
    expect(await screen.findByText(/Your journey/)).toBeInTheDocument();
    expect(screen.queryByText('Please enter a valid mobile number.')).not.toBeInTheDocument();
  });

  it('a transport failure with no `fields` still shows a plain, dismissible banner', async () => {
    const user = await submitWith({
      status: 'error',
      message: "We couldn't reach us just now — please try again in a moment.",
    });

    const banner = await screen.findByTestId('lead-form-error');
    expect(banner).toHaveTextContent("We couldn't reach us just now");

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByTestId('lead-form-error')).not.toBeInTheDocument();
  });

  it('never reaches the done step on an error — no fabricated confirmation', async () => {
    await submitWith({
      status: 'error',
      message: 'Some details need fixing before we can send this.',
      fields: { mobile: ['Please enter a valid mobile number.'] },
    });

    await screen.findByTestId('lead-form-error');
    expect(screen.queryByRole('heading', { name: /starts here/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/GTY has your details/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Name *')).toBeVisible();
  });
});

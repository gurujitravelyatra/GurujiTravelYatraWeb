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

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Name *'), 'Asha Patel');
  await user.type(screen.getByLabelText('Mobile Number *'), '9876543210');
}

describe('LeadModal variant="brochure"', () => {
  beforeEach(() => {
    submitLead.mockReset();
  });

  /**
   * New brief (2026-11-15): both variants now share ONE visible marketing
   * heading ("Tell us where your heart leads.") — the per-variant copy
   * lives in the sr-only Radix `DialogTitle` instead (the dialog's
   * accessible name), and in the CTA/context-chip label.
   */
  it('renders brochure-specific copy and CTA the enquiry variant does not use', () => {
    render(<LeadModal variant="brochure" open context={context} onClose={jest.fn()} />);

    expect(screen.getByRole('heading', { name: 'Get Your Complete Travel Brochure' })).toHaveClass('sr-only');
    expect(screen.getByRole('button', { name: /Get my brochure/ })).toBeInTheDocument();
    expect(screen.getByText('Brochure for')).toBeInTheDocument();
  });

  it('submits formType "brochure" with the package name taken from the context chip', async () => {
    const user = userEvent.setup();
    submitLead.mockResolvedValue({ status: 'success', leadId: 'lead-1' });

    render(<LeadModal variant="brochure" open context={context} onClose={jest.fn()} />);
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /Get my brochure/ }));

    expect(submitLead.mock.calls[0][0]).toMatchObject({
      formType: 'brochure',
      packageName: 'Spiti Valley Circuit',
      interestedIn: 'Spiti Valley Circuit',
    });
  });

  it('required-field validation blocks submit the same as the enquiry variant', async () => {
    const user = userEvent.setup();
    render(<LeadModal variant="brochure" open context={context} onClose={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: /Get my brochure/ }));

    expect(await screen.findByText('Please enter your full name.')).toBeInTheDocument();
    expect(screen.getByText('Please enter your mobile number.')).toBeInTheDocument();
    expect(submitLead).not.toHaveBeenCalled();
  });

  /**
   * New brief (2026-11-15), item 4: the confirmation panel is now the SAME
   * two-button shape in both variants — "Close" plus one variant-specific
   * CTA ("Download brochure" here, "Continue exploring" for enquiry) — not
   * the previous 4-stub-button brochure-only layout.
   */
  it("the done step says the brochure is ready and offers a single Download brochure CTA alongside Close", async () => {
    const user = userEvent.setup();
    submitLead.mockResolvedValue({ status: 'success', leadId: 'lead-1' });

    render(<LeadModal variant="brochure" open context={context} onClose={jest.fn()} />);
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /Get my brochure/ }));

    expect(await screen.findByText('Thank you!')).toBeInTheDocument();
    expect(screen.getByText('Your brochure is ready.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download brochure/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /View Brochure/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send to Email' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'On WhatsApp' })).not.toBeInTheDocument();
  });

  it("the enquiry variant's done step does NOT render the brochure-specific CTA", async () => {
    const user = userEvent.setup();
    submitLead.mockResolvedValue({ status: 'success', leadId: 'lead-1' });

    render(<LeadModal variant="enquiry" open context={context} onClose={jest.fn()} />);
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /Send my enquiry/ }));

    expect(await screen.findByText(/Thank you, Asha!/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Download brochure/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue exploring/ })).toBeInTheDocument();
  });

  it('shows the brochure-specific toast on success', async () => {
    const user = userEvent.setup();
    submitLead.mockResolvedValue({ status: 'success', leadId: 'lead-1' });

    render(<LeadModal variant="brochure" open context={context} onClose={jest.fn()} />);
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /Get my brochure/ }));

    await screen.findByText('Thank you!');
    expect(await screen.findByRole('status')).toHaveTextContent('Brochure request submitted');
  });
});

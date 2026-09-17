import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LeadModal } from '../LeadModal';
import { submitLeadRequest } from '@/lib/leads/lead-api-client';

jest.mock('@/lib/leads/lead-api-client', () => ({
  ...jest.requireActual('@/lib/leads/lead-api-client'),
  submitLeadRequest: jest.fn(),
}));

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

  it('renders brochure-specific copy and CTA the enquiry variant does not use', () => {
    render(<LeadModal variant="brochure" open context={context} onClose={jest.fn()} />);

    // The copy deliberately appears twice, as two <h2>s: ModalShell's sr-only
    // Radix <DialogTitle> (which supplies the dialog's accessible name) and
    // FormStep's visible chrome. Assert the visible one specifically.
    const headings = screen.getAllByRole('heading', { name: 'Get Your Complete Travel Brochure' });
    expect(headings).toHaveLength(2);
    expect(headings.filter((h) => !h.classList.contains('sr-only'))).toHaveLength(1);
    expect(screen.getByRole('button', { name: /Get My Brochure/ })).toBeInTheDocument();
    expect(screen.getByText('Brochure for')).toBeInTheDocument();
  });

  it('submits formType "brochure" with the package name taken from the context chip', async () => {
    const user = userEvent.setup();
    submitLead.mockResolvedValue({ status: 'success', leadId: 'lead-1' });

    render(<LeadModal variant="brochure" open context={context} onClose={jest.fn()} />);
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /Get My Brochure/ }));

    expect(submitLead.mock.calls[0][0]).toMatchObject({
      formType: 'brochure',
      packageName: 'Spiti Valley Circuit',
      interestedIn: 'Spiti Valley Circuit',
    });
  });

  it('required-field validation blocks submit the same as the enquiry variant', async () => {
    const user = userEvent.setup();
    render(<LeadModal variant="brochure" open context={context} onClose={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: /Get My Brochure/ }));

    expect(await screen.findByText('Please enter your full name.')).toBeInTheDocument();
    expect(screen.getByText('Please enter your mobile number.')).toBeInTheDocument();
    expect(submitLead).not.toHaveBeenCalled();
  });

  it('the done step renders the 4 brochure-specific unlock buttons plus Keep Exploring', async () => {
    const user = userEvent.setup();
    submitLead.mockResolvedValue({ status: 'success', leadId: 'lead-1' });

    render(<LeadModal variant="brochure" open context={context} onClose={jest.fn()} />);
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /Get My Brochure/ }));

    expect(await screen.findByText('Your Spiti Valley Circuit brochure is ready.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /View Brochure/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download Brochure/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send to Email' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'On WhatsApp' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Keep Exploring/ })).toBeInTheDocument();
  });

  it('the enquiry variant\'s done step does NOT render the brochure-specific buttons', async () => {
    const user = userEvent.setup();
    submitLead.mockResolvedValue({ status: 'success', leadId: 'lead-1' });

    render(<LeadModal variant="enquiry" open context={context} onClose={jest.fn()} />);
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /Start Your Journey/ }));

    expect(await screen.findByText(/GTY will call you about Spiti Valley Circuit/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /View Brochure/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Download Brochure/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send to Email' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'On WhatsApp' })).not.toBeInTheDocument();
    // "Keep Exploring" is common to both variants' done step.
    expect(screen.getByRole('button', { name: /Keep Exploring/ })).toBeInTheDocument();
  });
});

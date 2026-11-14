import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { InlineEnquiryForm } from '../InlineEnquiryForm';
import { submitLeadRequest } from '@/lib/leads/lead-api-client';
import type { LeadApiResult } from '@/lib/leads/lead-api-client';

jest.mock('@/lib/leads/lead-api-client', () => ({
  ...jest.requireActual('@/lib/leads/lead-api-client'),
  submitLeadRequest: jest.fn(),
}));

// Same reason every LeadModal test mocks this — never load the real
// Cloudflare script in a test; see the manual mock's own header.
jest.mock('@/components/modals/TurnstileWidget');

const submitLead = submitLeadRequest as jest.Mock;

beforeEach(() => {
  submitLead.mockReset();
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Your name'), 'Asha Patel');
  await user.type(screen.getByLabelText('Phone number'), '9876543210');
  await user.selectOptions(screen.getByLabelText('What are you dreaming of?'), 'Spiritual yatra');
}

describe('InlineEnquiryForm', () => {
  it('renders the reference card\'s fields and submit copy', () => {
    render(<InlineEnquiryForm happyTravellersLabel="10,000+" />);

    expect(screen.getByText('Tell us where')).toBeInTheDocument();
    expect(screen.getByText('your heart leads.')).toBeInTheDocument();
    expect(screen.getByLabelText('Your name')).toBeInTheDocument();
    expect(screen.getByLabelText('Phone number')).toBeInTheDocument();
    expect(screen.getByLabelText('Email (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('What are you dreaming of?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send my enquiry/ })).toBeInTheDocument();
    expect(screen.getByText('No pressure, no spam — just thoughtful travel ideas.')).toBeInTheDocument();
  });

  it('offers exactly the six journey types the brief names', () => {
    render(<InlineEnquiryForm happyTravellersLabel="10,000+" />);
    const select = screen.getByLabelText('What are you dreaming of?');

    for (const type of ['Spiritual yatra', 'Group tour', 'Family holiday', 'Adventure', 'International', 'Custom trip']) {
      expect(within(select).getByRole('option', { name: type })).toBeInTheDocument();
    }
  });

  /** New brief, Part 4A: "use the CRM happyTravellersLabel; remove the rating and 'this month' claims unless the CRM provides them." */
  describe('proof pill — real CRM figure only, no invented claims', () => {
    it('shows the real happyTravellersLabel, with no rating or "this month" text', () => {
      render(<InlineEnquiryForm happyTravellersLabel="10,000+" />);

      expect(screen.getByText('10,000+ happy travellers')).toBeInTheDocument();
      expect(screen.queryByText(/4\.9/)).not.toBeInTheDocument();
      expect(screen.queryByText(/this month/i)).not.toBeInTheDocument();
    });

    it('renders no proof pill at all when the CRM has not set a figure', () => {
      render(<InlineEnquiryForm happyTravellersLabel={null} />);
      expect(screen.queryByText(/happy travellers/)).not.toBeInTheDocument();
    });
  });

  it('requires a journey type — inline error, no submission, no crash', async () => {
    const user = userEvent.setup();
    render(<InlineEnquiryForm happyTravellersLabel="10,000+" />);

    await user.type(screen.getByLabelText('Your name'), 'Asha Patel');
    await user.type(screen.getByLabelText('Phone number'), '9876543210');
    await user.click(screen.getByRole('button', { name: /Send my enquiry/ }));

    expect(screen.getByText('Please select a journey type.')).toBeInTheDocument();
    expect(submitLead).not.toHaveBeenCalled();
  });

  it('submits through the same buildLeadRequest/submitLeadRequest pipeline the modal uses, mapping the journey type to pageName/interestedIn', async () => {
    const user = userEvent.setup();
    submitLead.mockResolvedValue({ status: 'success', leadId: 'lead-1' });
    render(<InlineEnquiryForm happyTravellersLabel="10,000+" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /Send my enquiry/ }));

    expect(await screen.findByText('We’ve got it.')).toBeInTheDocument();
    expect(submitLead).toHaveBeenCalledTimes(1);
    expect(submitLead.mock.calls[0][0]).toMatchObject({
      formType: 'enquiry',
      pageName: 'Spiritual yatra',
      interestedIn: 'Spiritual yatra',
      name: 'Asha Patel',
      mobile: '+919876543210',
      consent: true,
    });
  });

  it('shows a dismissible-free inline error banner and preserves entered values on a server error', async () => {
    const user = userEvent.setup();
    submitLead.mockResolvedValue({ status: 'error', message: 'Visitor safe message.' });
    render(<InlineEnquiryForm happyTravellersLabel="10,000+" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /Send my enquiry/ }));

    expect(await screen.findByTestId('inline-enquiry-error')).toHaveTextContent('Visitor safe message.');
    expect(screen.getByLabelText('Your name')).toHaveValue('Asha Patel');
  });

  it('shows a loading state while the request is in flight', async () => {
    const user = userEvent.setup();
    let resolve!: (value: LeadApiResult) => void;
    submitLead.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<InlineEnquiryForm happyTravellersLabel="10,000+" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /Send my enquiry/ }));

    expect(screen.getByText('Sending…')).toBeInTheDocument();
    resolve({ status: 'success', leadId: 'lead-1' });
    expect(await screen.findByText('We’ve got it.')).toBeInTheDocument();
  });

  it('centres the Turnstile widget above the submit button', () => {
    render(<InlineEnquiryForm happyTravellersLabel="10,000+" />);
    expect(screen.getByTestId('turnstile-widget-mock')).toBeInTheDocument();
  });
});

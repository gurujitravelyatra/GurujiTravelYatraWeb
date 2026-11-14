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

// CRM-migration Step 3: never load the real Cloudflare script in a test —
// see `src/components/modals/__mocks__/TurnstileWidget.tsx`'s own header.
jest.mock('../TurnstileWidget');

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
  // CRM-migration Step 3: consent is the one other REQUIRED field — the
  // mocked `TurnstileWidget` above already supplies `turnstileToken` the
  // instant it mounts, so this is the only extra step every test needs.
  await user.click(screen.getByLabelText(/I agree to be contacted/));
}

describe('LeadModal variant="enquiry"', () => {
  beforeEach(() => {
    submitLead.mockReset();
  });

  it('blocks submit when Name/Mobile are missing', async () => {
    const user = userEvent.setup();
    render(<LeadModal variant="enquiry" open context={context} onClose={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: /Send my enquiry/ }));

    expect(await screen.findByText('Please enter your full name.')).toBeInTheDocument();
    expect(screen.getByText('Please enter your mobile number.')).toBeInTheDocument();
    expect(submitLead).not.toHaveBeenCalled();
  });

  /** New brief (2026-11-15), item 3: client validation now enforces the per-country digit rule, not just the generic length/shape regex. */
  it('blocks submit on a mobile number that is the right shape but not a valid Indian number', async () => {
    const user = userEvent.setup();
    render(<LeadModal variant="enquiry" open context={context} onClose={jest.fn()} />);

    await user.type(screen.getByLabelText('Name *'), 'Asha Patel');
    // 10 digits, but does not start 6-9 — passes the old generic regex, fails the new per-country rule.
    await user.type(screen.getByLabelText('Mobile Number *'), '1234567890');
    await user.click(screen.getByLabelText(/I agree to be contacted/));
    await user.click(screen.getByRole('button', { name: /Send my enquiry/ }));

    expect(await screen.findByText('Please enter a valid mobile number.')).toBeInTheDocument();
    expect(submitLead).not.toHaveBeenCalled();
  });

  /** New brief (2026-11-15), item 3: "focus the first invalid field". */
  it('focuses the first invalid field on a blocked submit (Name, before Mobile)', async () => {
    const user = userEvent.setup();
    render(<LeadModal variant="enquiry" open context={context} onClose={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: /Send my enquiry/ }));

    await screen.findByText('Please enter your full name.');
    expect(screen.getByLabelText('Name *')).toHaveFocus();
  });

  /** Mobile is the custom `useController`/`PhoneField` field — it needs its own `ref` wired back to react-hook-form to be focusable this way at all (see `PhoneField.tsx`). */
  it('focuses the phone field when it is the only invalid one', async () => {
    const user = userEvent.setup();
    render(<LeadModal variant="enquiry" open context={context} onClose={jest.fn()} />);

    await user.type(screen.getByLabelText('Name *'), 'Asha Patel');
    await user.click(screen.getByLabelText(/I agree to be contacted/));
    await user.click(screen.getByRole('button', { name: /Send my enquiry/ }));

    await screen.findByText('Please enter your mobile number.');
    expect(screen.getByLabelText('Mobile Number *')).toHaveFocus();
  });

  it('does not block submit when only the optional fields are empty', async () => {
    const user = userEvent.setup();
    const { promise } = deferred<LeadApiResult>();
    submitLead.mockReturnValue(promise);

    render(<LeadModal variant="enquiry" open context={context} onClose={jest.fn()} />);
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /Send my enquiry/ }));

    expect(submitLead).toHaveBeenCalledTimes(1);
    // Brief §E2 (2026-11-14): the submitted value is now the full
    // international number — "+91" (the default country) + the digits
    // typed into the field — not the bare local number.
    expect(submitLead).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Asha Patel', mobile: '+919876543210', email: undefined })
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
    await user.click(screen.getByRole('button', { name: /Send my enquiry/ }));

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
    await user.click(screen.getByRole('button', { name: /Send my enquiry/ }));

    const request = submitLead.mock.calls[0][0];
    expect(request).toMatchObject({ formType: 'enquiry' });
    expect(request.pageName).toBeUndefined();
    expect(request.interestedIn).toBeUndefined();
  });

  it('shows a disabled, spinning submit button while sending — the form stays on screen, no double submit', async () => {
    const user = userEvent.setup();
    const { promise, resolve } = deferred<LeadApiResult>();
    submitLead.mockReturnValue(promise);

    render(<LeadModal variant="enquiry" open context={context} onClose={jest.fn()} />);
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /Send my enquiry/ }));

    const sendingButton = await screen.findByRole('button', { name: /Sending/ });
    expect(sendingButton).toBeDisabled();
    // The form itself — not a separate full-screen "sending" step — is still on screen.
    expect(screen.getByLabelText('Name *')).toHaveValue('Asha Patel');

    await act(async () => {
      resolve({ status: 'success', leadId: 'lead-1' });
    });
    expect(await screen.findByText(/Thank you, Asha!/)).toBeInTheDocument();
  });

  it('transitions form -> form-with-error, and the error path preserves every entered value', async () => {
    const user = userEvent.setup();
    submitLead.mockResolvedValue({ status: 'error', message: 'Visitor safe message.' });

    render(<LeadModal variant="enquiry" open context={context} onClose={jest.fn()} />);
    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('City'), 'Ahmedabad');
    await user.click(screen.getByRole('button', { name: /Send my enquiry/ }));

    const banner = await screen.findByTestId('lead-form-error');
    expect(banner).toHaveTextContent('Visitor safe message.');
    expect(screen.getByLabelText('Name *')).toHaveValue('Asha Patel');
    expect(screen.getByLabelText('Mobile Number *')).toHaveValue('9876543210');
    expect(screen.getByLabelText('City')).toHaveValue('Ahmedabad');
  });

  /** New brief (2026-11-15), item 4: every error banner carries the phone-number fallback, alongside (not instead of) the specific message. */
  it('the error banner always offers the phone-number fallback alongside the specific message', async () => {
    const user = userEvent.setup();
    submitLead.mockResolvedValue({ status: 'error', message: 'Visitor safe message.' });

    render(<LeadModal variant="enquiry" open context={context} onClose={jest.fn()} />);
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /Send my enquiry/ }));

    const banner = await screen.findByTestId('lead-form-error');
    expect(banner).toHaveTextContent('Visitor safe message.');
    expect(banner).toHaveTextContent('+91 90999 57658');
  });

  it('"Try Again" re-submits with the same preserved values', async () => {
    const user = userEvent.setup();
    submitLead.mockResolvedValue({ status: 'error', message: 'Visitor safe message.' });

    render(<LeadModal variant="enquiry" open context={context} onClose={jest.fn()} />);
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /Send my enquiry/ }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(submitLead).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(submitLead).toHaveBeenCalledTimes(2);
    expect(submitLead.mock.calls[1][0]).toEqual(expect.objectContaining({ name: 'Asha Patel', mobile: '+919876543210' }));
  });

  /**
   * The route's 200 carries no visitor-facing copy (only `leadId`/`source`/
   * `receivedAt`), so the confirmation panel's copy is composed from the
   * context the client already has rather than from a server string.
   */
  it('transitions form -> done on a successful submission, with a named confirmation panel', async () => {
    const user = userEvent.setup();
    submitLead.mockResolvedValue({ status: 'success', leadId: 'lead-42' });

    render(<LeadModal variant="enquiry" open context={context} onClose={jest.fn()} />);
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /Send my enquiry/ }));

    expect(await screen.findByText('Thank you, Asha!')).toBeInTheDocument();
    expect(
      screen.getByText('Your enquiry has been submitted. Team Guruji will contact you very soon.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue exploring/ })).toBeInTheDocument();
  });

  it('shows a toast on success and the "Continue exploring"/"Close" buttons both close the modal', async () => {
    const user = userEvent.setup();
    submitLead.mockResolvedValue({ status: 'success', leadId: 'lead-42' });
    const onClose = jest.fn();

    render(<LeadModal variant="enquiry" open context={context} onClose={onClose} />);
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /Send my enquiry/ }));

    await screen.findByText('Thank you, Asha!');
    expect(await screen.findByRole('status')).toHaveTextContent('Enquiry submitted');

    await user.click(screen.getByRole('button', { name: /Continue exploring/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  /**
   * New brief (2026-11-15, "horizontal card"): every field (Name, City,
   * Mobile, Email, Travel date, Travellers) now shares ONE compact 2-column
   * grid — Name|City, Mobile|Email, Travel date|Travellers — collapsing to
   * a single stacked column below the card's own 781px breakpoint, not
   * Tailwind's default `sm:`.
   */
  it('lays out every field in one shared 2-column grid from 781px up, stacked below it', () => {
    render(<LeadModal variant="enquiry" open context={context} onClose={jest.fn()} />);

    const fieldGrid = screen.getByLabelText('Mobile Number *').closest('.grid');
    expect(fieldGrid).toHaveClass('grid-cols-1', 'min-[781px]:grid-cols-2');
    // Name, City, Mobile, Email, Travel date and Travellers are all direct
    // children of that SAME grid — not four separate 2-up sub-grids.
    expect(screen.getByLabelText('Travel Date').closest('.grid')).toBe(fieldGrid);
    expect(screen.getByLabelText('Name *').closest('.grid')).toBe(fieldGrid);
  });

  /**
   * New brief (2026-11-15, "horizontal card"): both the Name field's own
   * `Input` and the phone field's wrapper now share the SAME `vh`-clamped
   * min-height (via `Field`'s cloned className, for the height-budget
   * work — see `LeadModal.tsx`'s own header) rather than a fixed 44px, so
   * this now compares their rendered heights directly instead of pinning
   * one shared class string.
   */
  it("the phone field's box is the same height as the Name field's", () => {
    render(<LeadModal variant="enquiry" open context={context} onClose={jest.fn()} />);

    const phoneBox = screen.getByLabelText('Mobile Number *').closest('div');
    const nameInput = screen.getByLabelText('Name *');
    expect(phoneBox).toHaveClass('min-h-[clamp(32px,6vh,44px)]');
    expect(nameInput).toHaveClass('min-h-[clamp(32px,6vh,44px)]');
  });

  /** New brief (2026-11-15), item 3: belt-and-braces — never a native GET-reload submit, on an empty OR a filled form. */
  it('never falls back to a native form submission', async () => {
    render(<LeadModal variant="enquiry" open context={context} onClose={jest.fn()} />);

    const form = screen.getByRole('button', { name: /Send my enquiry/ }).closest('form');
    expect(form).toHaveAttribute('method', 'post');

    const event = new Event('submit', { bubbles: true, cancelable: true });
    act(() => {
      form!.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
  });

  // CRM-migration Step 3: the submit path now genuinely reaches a CRM
  // (`POST /api/leads` -> `POST /public/enquiries`), but the visitor-facing
  // copy still should not say so in those words — "CRM" is internal jargon
  // a visitor has no use for — and still may not claim guaranteed delivery,
  // a specific rate limit, or encryption, none of which this form step
  // promises anywhere in its own copy.
  describe('claims no capability the submit path does not have', () => {
    const FALSE_CLAIMS = [/server-side/i, /rate.?limit/i, /\bCRM\b/, /encrypted/i];

    it('makes no such claim on the form step', () => {
      const { container } = render(<LeadModal variant="enquiry" open context={context} onClose={jest.fn()} />);

      expect(screen.getByText('No pressure, no spam, just thoughtful travel ideas.')).toBeInTheDocument();
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

    it('makes no such claim while the request is in flight', async () => {
      const user = userEvent.setup();
      const { promise } = deferred<LeadApiResult>();
      submitLead.mockReturnValue(promise);

      const { container } = render(<LeadModal variant="enquiry" open context={context} onClose={jest.fn()} />);
      await fillRequiredFields(user);
      await user.click(screen.getByRole('button', { name: /Send my enquiry/ }));

      expect(await screen.findByRole('button', { name: /Sending/ })).toBeInTheDocument();
      for (const claim of FALSE_CLAIMS) {
        expect(container.textContent ?? '').not.toMatch(claim);
      }
    });
  });
});

import { render, screen, within } from '@testing-library/react';

import PrivacyPolicyPage from '../privacy-policy/page';
import TermsAndConditionsPage from '../terms-and-conditions/page';

// Same stub the Navbar suite uses — SiteShell mounts client triggers that call
// `useModal()`, and these pages are being tested for their own content, not
// for modal wiring.
jest.mock('@/components/modals/modal-context', () => ({
  useModal: () => ({ modal: null, openEnquiry: jest.fn(), openBrochure: jest.fn(), close: jest.fn() }),
}));

/**
 * The Footer's Support column has always linked to these two routes; until now
 * both 404'd while the Enquiry/Brochure modals collected name, mobile and
 * email. These tests lock in that the pages exist, render inside the normal
 * site chrome, and — critically — stay visibly marked as placeholder copy.
 */
const pages = [
  { name: 'Privacy Policy', heading: 'Privacy Policy', Page: PrivacyPolicyPage },
  { name: 'Terms & Conditions', heading: 'Terms & Conditions', Page: TermsAndConditionsPage },
] as const;

describe.each(pages)('$name page', ({ heading, Page }) => {
  it('renders its heading as the page h1', () => {
    render(<Page />);
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
  });

  it('renders inside the site chrome (breadcrumb back to Home, real footer)', () => {
    render(<Page />);

    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(breadcrumb).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(within(breadcrumb).getByText(heading)).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('carries the visible "not final" placeholder notice', () => {
    render(<Page />);

    // Non-negotiable: this copy was written by the build, not by a lawyer.
    // If a later pass removes the banner it must also replace the body text.
    const notice = screen.getByTestId('legal-placeholder-notice');
    expect(notice).toHaveTextContent(/placeholder legal copy pending review by GTY's legal counsel/i);
    expect(notice).toHaveTextContent(/do not treat as final/i);
    // The forms genuinely do not submit anywhere yet — say so.
    expect(notice).toHaveTextContent(/not yet connected to a live submission service/i);
  });

  it('states no fabricated effective date, jurisdiction or named officer', () => {
    const { container } = render(<Page />);
    const text = container.textContent ?? '';

    // Each of these would be a specific legal claim GTY has not made. Omitting
    // them is correct; inventing one to look complete is not.
    expect(text).not.toMatch(/last updated|effective date|effective from/i);
    expect(text).not.toMatch(/governed by the laws of|exclusive jurisdiction of the courts/i);
    expect(text).not.toMatch(/data protection officer|grievance officer/i);
  });

  it('exposes no admin, login or CMS surface', () => {
    const { container } = render(<Page />);

    for (const link of Array.from(container.querySelectorAll('a'))) {
      expect(link.getAttribute('href')).not.toMatch(/admin|login|sign-?in|dashboard|cms|wp-/i);
    }
  });

  it('gives a real way to reach GTY about the policy', () => {
    render(<Page />);

    const main = screen.getByRole('main');
    expect(within(main).getByText(/info@gurujitravelyatra\.com/)).toBeInTheDocument();
    expect(within(main).getByText(/\+91 90999 57658/)).toBeInTheDocument();
  });
});

describe('Privacy Policy content', () => {
  it('describes exactly the fields the lead forms collect', () => {
    render(<PrivacyPolicyPage />);

    expect(screen.getByRole('heading', { level: 2, name: '1. Information We Collect' })).toBeInTheDocument();
    expect(screen.getByText(/Name and mobile number — required/)).toBeInTheDocument();
    expect(screen.getByText(/Email address — optional/)).toBeInTheDocument();
  });

  it('commits to the negatives that matter for a lead-capture form', () => {
    render(<PrivacyPolicyPage />);

    expect(screen.getByText(/We do not sell your personal information\./)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '2. How We Use Your Information' })).toBeInTheDocument();
  });

  it('names no analytics vendor, cookie category or CRM that the site does not use', () => {
    const { container } = render(<PrivacyPolicyPage />);
    const text = container.textContent ?? '';

    expect(text).not.toMatch(/google analytics|facebook pixel|hotjar|salesforce|hubspot/i);
    expect(text).not.toMatch(/\bcookies?\b/i);
  });
});

describe('Terms & Conditions content', () => {
  it('is explicit that the site takes enquiries, not bookings or payments', () => {
    render(<TermsAndConditionsPage />);

    expect(screen.getByText(/It is not a booking engine/)).toBeInTheDocument();
    expect(screen.getByText(/does not create a booking, hold a seat, or take any payment/)).toBeInTheDocument();
  });

  it('describes prices as indicative, matching the unverified pricing in the tour data', () => {
    render(<TermsAndConditionsPage />);

    expect(screen.getByText(/are indicative and are confirmed with you at the time of enquiry/)).toBeInTheDocument();
  });

  it('invents no cancellation percentages or payment schedule', () => {
    const { container } = render(<TermsAndConditionsPage />);
    const text = container.textContent ?? '';

    // `/legal/cancellation-policy` and `/legal/refund-policy` are still
    // unwritten; this page must not pre-empt them with made-up numbers.
    expect(text).not.toMatch(/\d+\s?% (of the|refund|cancellation)/i);
    expect(text).not.toMatch(/\d+ days before departure/i);
  });
});

import { render, screen, within } from '@testing-library/react';

import { Footer } from '../Footer';
import { resolveSiteContact } from '@/lib/site-contact';

const contact = resolveSiteContact(null);
const PHONE_DISPLAY = contact.phoneDisplay;
const EMAIL = contact.email;

describe('Footer', () => {
  it('renders the Quick Links column pointing at the five real routes', () => {
    render(<Footer contact={contact} />);

    const expected = [
      ['Home', '/'],
      ['Tour Packages', '/tour-packages'],
      ['Group Tours', '/group-tours'],
      ['Customized Tours', '/customize-tours'],
      ['About Us', '/about-us'],
    ] as const;

    for (const [label, href] of expected) {
      expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href);
    }
  });

  /**
   * Design review 2026-11-01: "Top Destinations" and "Support" were removed
   * completely (data and links, not just hidden) — this is the regression
   * guard for that. `places` is no longer even a `Footer` prop (see
   * `SiteShell`, which stopped fetching `GET /public/places` for it).
   */
  it('renders no Top Destinations or Support column, and no link to any removed Support route or /legal/faqs', () => {
    render(<Footer contact={contact} />);

    expect(screen.queryByText('Top Destinations')).not.toBeInTheDocument();
    expect(screen.queryByText('Support')).not.toBeInTheDocument();

    const removedLabels = ['Travel Tips', 'Cancellation Policy', 'Terms & Conditions', 'Privacy Policy', 'Refund Policy', 'FAQs'];
    for (const label of removedLabels) {
      expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument();
    }

    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).not.toBe('/legal/faqs');
    }
  });

  it('renders the real phone/email as actionable tel: and mailto: links, plus a non-link address', () => {
    render(<Footer contact={contact} />);

    expect(screen.getByRole('link', { name: new RegExp(PHONE_DISPLAY.replace(/\+/g, '\\+')) })).toHaveAttribute(
      'href',
      `tel:${contact.phoneTel}`
    );
    expect(screen.getByRole('link', { name: new RegExp(EMAIL) })).toHaveAttribute('href', `mailto:${EMAIL}`);

    const address = screen.getByText(contact.address);
    expect(address.closest('a')).toBeNull();
  });

  /**
   * Design review 2026-11-04: YouTube, Facebook, X (Twitter) and LinkedIn
   * were removed completely — they were never real links (every one pointed
   * at a bare `#` stub). Instagram and WhatsApp are the only two social
   * links the business actually uses, and both resolve to a real URL.
   */
  it('links Instagram and WhatsApp to their resolved contact URLs, and renders no other social button', () => {
    render(<Footer contact={contact} />);

    const instagram = screen.getByRole('link', { name: 'Instagram' });
    expect(instagram).toHaveAttribute('href', contact.instagramUrl);
    expect(instagram).toHaveAttribute('rel', 'noopener noreferrer');

    const whatsapp = screen.getByRole('link', { name: 'WhatsApp' });
    expect(whatsapp).toHaveAttribute('href', contact.whatsappUrl);
    expect(whatsapp).toHaveAttribute('rel', 'noopener noreferrer');

    for (const label of ['YouTube', 'Facebook', 'X (Twitter)', 'LinkedIn']) {
      expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument();
    }
  });

  it('exposes no admin, login, dashboard or CMS surface anywhere', () => {
    const { container } = render(<Footer contact={contact} />);

    for (const link of Array.from(container.querySelectorAll('a'))) {
      expect(link.getAttribute('href')).not.toMatch(/admin|login|sign-?in|dashboard|cms|wp-/i);
    }
    expect(container.textContent).not.toMatch(/\b(admin|log ?in|sign ?in|dashboard)\b/i);
  });

  it('renders the copyright bar with the CURRENT year, not a hardcoded one', () => {
    render(<Footer contact={contact} />);

    const currentYear = new Date().getFullYear();
    expect(
      screen.getByText(new RegExp(`© ${currentYear} Guruji Travel Yatra\\. All Rights Reserved\\.`))
    ).toBeInTheDocument();
  });

  it('computes the copyright year from the clock (proved by moving the clock)', () => {
    jest.useFakeTimers().setSystemTime(new Date('2031-03-04T10:00:00Z'));
    try {
      render(<Footer contact={contact} />);
      expect(screen.getByText(/© 2031 Guruji Travel Yatra/)).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it('marks the decorative mountain art as hidden from assistive tech', () => {
    const { container } = render(<Footer contact={contact} />);

    const band = container.querySelector('[aria-hidden="true"]');
    expect(band).toBeInTheDocument();
    expect(within(container).queryByRole('img', { name: /mountain/i })).not.toBeInTheDocument();
  });
});

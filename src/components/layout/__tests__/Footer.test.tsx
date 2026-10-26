import { render, screen, within } from '@testing-library/react';

import { Footer } from '../Footer';
import { resolveSiteContact } from '@/lib/site-contact';
import type { CrmPlace } from '@/server/crm/types';

const contact = resolveSiteContact(null);
const PHONE_DISPLAY = contact.phoneDisplay;
const EMAIL = contact.email;

function place(slug: string, name: string, liveTourCount: number): CrmPlace {
  return {
    name,
    slug,
    region: 'Region',
    description: 'A place.',
    imageUrl: 'https://res.cloudinary.com/place-images/abc.jpg',
    showInCustomBuilder: true,
    liveTourCount,
  };
}

const places: CrmPlace[] = [
  place('kedarnath', 'Kedarnath', 3),
  place('varanasi', 'Varanasi', 2),
  place('no-tours', 'No Tours Here', 0),
];

describe('Footer', () => {
  it('renders the Quick Links column pointing at the five real routes', () => {
    render(<Footer contact={contact} places={places} />);

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

  describe('Top Destinations column', () => {
    it('deep-links each destination to its own place-filtered catalogue — the CRM contract\'s own query param name', () => {
      render(<Footer contact={contact} places={places} />);

      const links = screen
        .getAllByRole('link')
        .filter((link) => link.getAttribute('href')?.startsWith('/tour-packages?place='));

      expect(links.length).toBeGreaterThan(0);
      const hrefs = links.map((link) => link.getAttribute('href'));
      expect(new Set(hrefs).size).toBe(hrefs.length);
    });

    it('names only destinations with at least one live tour (liveTourCount > 0)', () => {
      render(<Footer contact={contact} places={places} />);

      expect(screen.getByRole('link', { name: 'Kedarnath' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Varanasi' })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'No Tours Here' })).not.toBeInTheDocument();
    });
  });

  it('renders the Support links as real /legal routes, with NO link to /legal/faqs', () => {
    render(<Footer contact={contact} places={places} />);

    const expected = [
      ['Travel Tips', '/legal/travel-tips'],
      ['Cancellation Policy', '/legal/cancellation-policy'],
      ['Terms & Conditions', '/legal/terms-and-conditions'],
      ['Privacy Policy', '/legal/privacy-policy'],
      ['Refund Policy', '/legal/refund-policy'],
    ] as const;

    for (const [label, href] of expected) {
      expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href);
    }

    // The FAQs footer link was removed per the CRM-migration decision: the
    // page itself stays a deliberate 404, but the footer no longer points at
    // it.
    expect(screen.queryByRole('link', { name: 'FAQs' })).not.toBeInTheDocument();
  });

  it('renders the real phone/email as actionable tel: and mailto: links, plus a non-link address', () => {
    render(<Footer contact={contact} places={places} />);

    expect(screen.getByRole('link', { name: new RegExp(PHONE_DISPLAY.replace(/\+/g, '\\+')) })).toHaveAttribute(
      'href',
      `tel:${contact.phoneTel}`
    );
    expect(screen.getByRole('link', { name: new RegExp(EMAIL) })).toHaveAttribute('href', `mailto:${EMAIL}`);

    const address = screen.getByText(contact.address);
    expect(address.closest('a')).toBeNull();
  });

  it('links Instagram to the resolved contact URL and leaves every unconfirmed handle inert', () => {
    render(<Footer contact={contact} places={places} />);

    const instagram = screen.getByRole('link', { name: 'Instagram' });
    expect(instagram).toHaveAttribute('href', contact.instagramUrl);
    expect(instagram).toHaveAttribute('rel', 'noopener noreferrer');

    for (const label of ['YouTube', 'Facebook', 'X (Twitter)', 'LinkedIn']) {
      const link = screen.getByRole('link', { name: label });
      expect(link).toHaveAttribute('href', '#');
      expect(link).not.toHaveAttribute('target');
    }
  });

  it('exposes no admin, login, dashboard or CMS surface anywhere', () => {
    const { container } = render(<Footer contact={contact} places={places} />);

    for (const link of Array.from(container.querySelectorAll('a'))) {
      expect(link.getAttribute('href')).not.toMatch(/admin|login|sign-?in|dashboard|cms|wp-/i);
    }
    expect(container.textContent).not.toMatch(/\b(admin|log ?in|sign ?in|dashboard)\b/i);
  });

  it('renders the copyright bar with the CURRENT year, not a hardcoded one', () => {
    render(<Footer contact={contact} places={places} />);

    const currentYear = new Date().getFullYear();
    expect(
      screen.getByText(new RegExp(`© ${currentYear} Guruji Travel Yatra\\. All Rights Reserved\\.`))
    ).toBeInTheDocument();
  });

  it('computes the copyright year from the clock (proved by moving the clock)', () => {
    jest.useFakeTimers().setSystemTime(new Date('2031-03-04T10:00:00Z'));
    try {
      render(<Footer contact={contact} places={places} />);
      expect(screen.getByText(/© 2031 Guruji Travel Yatra/)).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it('marks the decorative mountain art as hidden from assistive tech', () => {
    const { container } = render(<Footer contact={contact} places={places} />);

    const band = container.querySelector('[aria-hidden="true"]');
    expect(band).toBeInTheDocument();
    expect(within(container).queryByRole('img', { name: /mountain/i })).not.toBeInTheDocument();
  });
});

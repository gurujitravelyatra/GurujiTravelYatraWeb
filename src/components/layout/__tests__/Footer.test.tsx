import { render, screen, within } from '@testing-library/react';

import { Footer } from '../Footer';
import { getDestinationOptions, toursRenderedOnCataloguePage } from '@/content/public-listing';
import { GTY_INSTAGRAM_URL } from '@/lib/gty-contact';

const PHONE_DISPLAY = '+91 90999 57658';
const EMAIL = 'info@gurujitravelyatra.com';

describe('Footer', () => {
  it('renders the Quick Links column pointing at the five real routes', () => {
    render(<Footer />);

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
    const listed = getDestinationOptions(toursRenderedOnCataloguePage);

    it('deep-links each destination to its own filtered catalogue, not to one shared page', () => {
      render(<Footer />);

      // Every entry used to point at the bare `/tour-packages`, making the
      // column seven links to an identical page.
      const links = screen
        .getAllByRole('link')
        .filter((link) => link.getAttribute('href')?.startsWith('/tour-packages?destination='));

      expect(links.length).toBeGreaterThan(0);
      const hrefs = links.map((link) => link.getAttribute('href'));
      expect(new Set(hrefs).size).toBe(hrefs.length);
    });

    it('names only destinations that have at least one publicly-listed journey', () => {
      render(<Footer />);

      const listedSlugs = new Set(listed.map((destination) => destination.slug));
      const destinationLinks = screen
        .getAllByRole('link')
        .filter((link) => link.getAttribute('href')?.startsWith('/tour-packages?destination='));

      for (const link of destinationLinks) {
        const slug = decodeURIComponent(link.getAttribute('href')!.split('destination=')[1]);
        expect(listedSlugs.has(slug)).toBe(true);
      }
    });

    it('advertises Kedarnath and Varanasi — CRM-migration decision 1 stopped withholding their tours', () => {
      render(<Footer />);

      // Do Dham Yatra (Kedarnath) and Kashi Darshan (Varanasi) used to carry
      // `pricingUnverified` and be withheld from every public listing. The
      // website no longer second-guesses a published tour's price, so these
      // destinations now have a real, non-empty catalogue behind them.
      for (const name of ['Kedarnath', 'Varanasi']) {
        expect(screen.getByRole('link', { name })).toBeInTheDocument();
      }
    });
  });

  it('renders the six Support links as real /legal routes (Decision G)', () => {
    render(<Footer />);

    const expected = [
      ['FAQs', '/legal/faqs'],
      ['Travel Tips', '/legal/travel-tips'],
      ['Cancellation Policy', '/legal/cancellation-policy'],
      ['Terms & Conditions', '/legal/terms-and-conditions'],
      ['Privacy Policy', '/legal/privacy-policy'],
      ['Refund Policy', '/legal/refund-policy'],
    ] as const;

    for (const [label, href] of expected) {
      expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href);
    }
  });

  it('renders the real phone/email as actionable tel: and mailto: links, plus a non-link address', () => {
    render(<Footer />);

    expect(screen.getByRole('link', { name: new RegExp(PHONE_DISPLAY.replace(/\+/g, '\\+')) })).toHaveAttribute(
      'href',
      'tel:+919099957658'
    );
    expect(screen.getByRole('link', { name: new RegExp(EMAIL) })).toHaveAttribute('href', `mailto:${EMAIL}`);

    // Address is informational only — it must not become a fabricated map link.
    const address = screen.getByText('Ahmedabad, Gujarat, India');
    expect(address.closest('a')).toBeNull();
  });

  it('links Instagram to the confirmed profile and leaves every unconfirmed handle inert', () => {
    render(<Footer />);

    // Instagram is the one handle the business confirmed, so it is a real
    // outbound link. The rest stay "#": inventing e.g. youtube.com/@gty would
    // ship a link to an account the brand may not own.
    const instagram = screen.getByRole('link', { name: 'Instagram' });
    expect(instagram).toHaveAttribute('href', GTY_INSTAGRAM_URL);
    expect(instagram).toHaveAttribute('rel', 'noopener noreferrer');

    for (const label of ['YouTube', 'Facebook', 'X (Twitter)', 'LinkedIn']) {
      const link = screen.getByRole('link', { name: label });
      expect(link).toHaveAttribute('href', '#');
      // An inert stub must not open a blank tab.
      expect(link).not.toHaveAttribute('target');
    }
  });

  it('exposes no admin, login, dashboard or CMS surface anywhere', () => {
    const { container } = render(<Footer />);

    for (const link of Array.from(container.querySelectorAll('a'))) {
      expect(link.getAttribute('href')).not.toMatch(/admin|login|sign-?in|dashboard|cms|wp-/i);
    }
    expect(container.textContent).not.toMatch(/\b(admin|log ?in|sign ?in|dashboard)\b/i);
  });

  it('renders the copyright bar with the CURRENT year, not a hardcoded one', () => {
    render(<Footer />);

    // Regression guard: the year was hardcoded to 2026 and would have read
    // wrong from 1 Jan onward. It must be derived from the clock.
    const currentYear = new Date().getFullYear();
    expect(
      screen.getByText(new RegExp(`© ${currentYear} Guruji Travel Yatra\\. All Rights Reserved\\.`))
    ).toBeInTheDocument();
  });

  it('computes the copyright year from the clock (proved by moving the clock)', () => {
    jest.useFakeTimers().setSystemTime(new Date('2031-03-04T10:00:00Z'));
    try {
      render(<Footer />);
      expect(screen.getByText(/© 2031 Guruji Travel Yatra/)).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it('marks the decorative mountain art as hidden from assistive tech', () => {
    const { container } = render(<Footer />);

    const band = container.querySelector('[aria-hidden="true"]');
    expect(band).toBeInTheDocument();
    // The scenic band carries no information, so it must not expose any
    // accessible name to a screen reader.
    expect(within(container).queryByRole('img', { name: /mountain/i })).not.toBeInTheDocument();
  });
});

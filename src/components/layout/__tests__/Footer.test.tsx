import { render, screen, within } from '@testing-library/react';

import { Footer } from '../Footer';

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

  it('sends every Top Destinations entry to /tour-packages (no invented per-destination routes)', () => {
    render(<Footer />);

    const names = [
      'Kedarnath Yatra',
      'Badrinath Yatra',
      'Spiti Valley',
      'Varanasi',
      'Rameshwaram',
      'Vaishnodevi',
      'Leh Ladakh',
    ];

    for (const name of names) {
      // The export routes all of these to `goPack`; none is a real slug this
      // sprint, so none may point at a fabricated /destinations/<slug> URL.
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', '/tour-packages');
    }
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

  it('renders social icons with inert placeholder hrefs rather than fabricated profile URLs', () => {
    render(<Footer />);

    // Real GTY social handles are not confirmed (TODO(social-links) in
    // Footer.tsx). Each must stay "#" — inventing e.g. instagram.com/gty
    // would ship a link to an account the brand may not own.
    for (const label of ['Instagram', 'YouTube', 'Facebook', 'X (Twitter)', 'LinkedIn']) {
      expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', '#');
    }
  });

  it('exposes no admin, login, dashboard or CMS surface anywhere', () => {
    const { container } = render(<Footer />);

    for (const link of Array.from(container.querySelectorAll('a'))) {
      expect(link.getAttribute('href')).not.toMatch(/admin|login|sign-?in|dashboard|cms|wp-/i);
    }
    expect(container.textContent).not.toMatch(/\b(admin|log ?in|sign ?in|dashboard)\b/i);
  });

  it('renders the copyright bar', () => {
    render(<Footer />);
    expect(screen.getByText(/© 2026 Guruji Travel Yatra\. All Rights Reserved\./)).toBeInTheDocument();
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

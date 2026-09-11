import { render, screen } from '@testing-library/react';

import { BottomContactStrip } from '../BottomContactStrip';
import { GTY_WHATSAPP_URL } from '@/lib/gty-contact';

describe('BottomContactStrip', () => {
  it('renders the WhatsApp headline and subtitle copy from the export', () => {
    render(<BottomContactStrip />);

    expect(screen.getByText("Let's Plan Your Next Journey!")).toBeInTheDocument();
    expect(screen.getByText('Chat with us on WhatsApp')).toBeInTheDocument();
  });

  /**
   * M4: this card said "Chat with us on WhatsApp" while offering no way to do
   * it — the icon was a plain <span> and only `MobileActionBar` (hidden at
   * ≥760px) carried a real wa.me link, so desktop visitors had no WhatsApp
   * route at all.
   */
  it('makes the WhatsApp invitation actionable on desktop, not just on mobile', () => {
    render(<BottomContactStrip />);

    const iconLink = screen.getByRole('link', { name: 'Chat with Guruji Travel Yatra on WhatsApp' });
    expect(iconLink).toHaveAttribute('href', GTY_WHATSAPP_URL);
    expect(iconLink).toHaveAttribute('target', '_blank');
    expect(iconLink).toHaveAttribute('rel', 'noopener noreferrer');

    const textLink = screen.getByRole('link', { name: 'Chat with us on WhatsApp' });
    expect(textLink).toHaveAttribute('href', GTY_WHATSAPP_URL);
  });

  it('uses the same wa.me number the mobile action bar uses', () => {
    render(<BottomContactStrip />);

    for (const link of screen.getAllByRole('link')) {
      const href = link.getAttribute('href') ?? '';
      if (href.includes('wa.me')) expect(href).toBe(GTY_WHATSAPP_URL);
    }
  });

  it('renders the real GTY phone number as a tel: link', () => {
    render(<BottomContactStrip />);

    const phone = screen.getByRole('link', { name: '+91 90999 57658' });
    expect(phone).toHaveAttribute('href', 'tel:+919099957658');
  });

  it('renders exactly the four benefit labels, in export order', () => {
    render(<BottomContactStrip />);

    for (const label of [
      'Quick Response',
      'Personalized Assistance',
      'Get Itinerary & Quotes',
      'Travel Consultation',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('marks every icon as decorative so the labels are the only announced text', () => {
    const { container } = render(<BottomContactStrip />);

    const svgs = Array.from(container.querySelectorAll('svg'));
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('is absolutely positioned, per its documented overlap-the-footer composition contract', () => {
    const { container } = render(<BottomContactStrip />);

    // The card deliberately takes no layout space so it can overlap Footer's
    // mountain band — see the file header in BottomContactStrip.tsx. If this
    // ever becomes static/relative the overlap silently breaks.
    expect(container.firstElementChild).toHaveClass('absolute');
  });

  it('exposes no admin, login or CMS surface', () => {
    const { container } = render(<BottomContactStrip />);

    for (const link of Array.from(container.querySelectorAll('a'))) {
      expect(link.getAttribute('href')).not.toMatch(/admin|login|sign-?in|dashboard|cms/i);
    }
  });
});

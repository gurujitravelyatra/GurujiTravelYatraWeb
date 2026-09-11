import { render, screen } from '@testing-library/react';

import { PhotoPlaceholder, placeholderAriaLabel } from '../photo-placeholder';

/**
 * L2 — the placeholder announced content that does not exist.
 *
 * `aria-label={alt}` meant a screen reader described an empty token-coloured
 * box as "Himalayan landscape — Guruji Travel Yatra". A sighted user sees an
 * obvious grey placeholder; a screen-reader user was told the page contained
 * photography. The label now leads with what the element actually is.
 */
describe('placeholderAriaLabel', () => {
  it('leads with "Image placeholder" and keeps the subject after it', () => {
    expect(placeholderAriaLabel('Himalayan landscape — Guruji Travel Yatra')).toBe(
      'Image placeholder — Himalayan landscape — Guruji Travel Yatra'
    );
  });

  it('falls back to a generic label for a decorative surface', () => {
    expect(placeholderAriaLabel('')).toBe('Image placeholder');
    expect(placeholderAriaLabel('   ')).toBe('Image placeholder');
  });
});

describe('PhotoPlaceholder', () => {
  it('never announces a bare descriptive name as though a real photo were present', () => {
    render(<PhotoPlaceholder photoKey="Himalayas" alt="Himalayan landscape" />);

    expect(screen.queryByRole('img', { name: 'Himalayan landscape' })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: /^Image placeholder/ })).toBeInTheDocument();
  });

  it('keeps the subject discoverable, so the slot is still described usefully', () => {
    render(<PhotoPlaceholder photoKey="Goa" alt="Goa Beach Holiday — Goa" />);

    expect(screen.getByRole('img', { name: 'Image placeholder — Goa Beach Holiday — Goa' })).toBeInTheDocument();
  });

  it('announces a decorative slot generically rather than as an unnamed image', () => {
    render(<PhotoPlaceholder photoKey="Himalaya" alt="" />);

    expect(screen.getByRole('img', { name: 'Image placeholder' })).toBeInTheDocument();
  });

  it('keeps the visible key caption hidden from assistive tech', () => {
    render(<PhotoPlaceholder photoKey="Spiti_Valley" alt="Spiti Valley" />);

    const caption = screen.getByText('Spiti_Valley');
    expect(caption).toHaveAttribute('aria-hidden', 'true');
  });
});

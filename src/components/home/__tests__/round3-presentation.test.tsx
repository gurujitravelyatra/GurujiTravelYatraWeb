import { render, screen, within } from '@testing-library/react';

import { Hero } from '../Hero';
import { InstagramStrip } from '../InstagramStrip';
import { Navbar } from '@/components/layout/Navbar';
import { WhatsAppCtaSection } from '@/components/layout/WhatsAppCtaSection';
import { resolveSiteContact } from '@/lib/site-contact';

jest.mock('@/components/modals/modal-context', () => ({
  useModal: () => ({ modal: null, openEnquiry: jest.fn(), openBrochure: jest.fn(), close: jest.fn() }),
}));

const contact = resolveSiteContact(null);

/**
 * Round 3 (2026-11-17) — the presentation-only changes from Parts 3-6 that a
 * unit test can pin down without a real layout engine. Sizes, overlap and
 * "nothing clipped" are checked in a real browser (design-review/round3/).
 */
describe('Part 3 — the WhatsApp contact box', () => {
  it('keeps the phone and WhatsApp links on the resolved contact values', () => {
    render(<WhatsAppCtaSection contact={contact} />);

    expect(screen.getByRole('link', { name: 'Chat on WhatsApp' })).toHaveAttribute('href', contact.whatsappUrl);
    expect(screen.getByRole('link', { name: 'Call Us' })).toHaveAttribute('href', `tel:${contact.phoneTel}`);
    expect(screen.getByRole('link', { name: contact.phoneDisplay })).toHaveAttribute('href', `tel:${contact.phoneTel}`);
  });

  it('puts the script line in normal flow above the WhatsApp icon, not absolutely positioned over it', () => {
    render(<WhatsAppCtaSection contact={contact} />);

    const script = screen.getByText('Journeys that stay forever');
    expect(script.className).not.toMatch(/\babsolute\b/);
    expect(script.className).not.toMatch(/\bhidden\b/);
    expect(script).toHaveAttribute('aria-hidden', 'true');
    // Same column as the heading, and before it in document order.
    const heading = screen.getByRole('heading', { name: /Plan Your/ });
    expect(script.parentElement).toBe(heading.parentElement);
    expect(script.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows the four feature tiles in a 2 x 2 grid and stacks full-width buttons on mobile', () => {
    render(<WhatsAppCtaSection contact={contact} />);

    const tile = screen.getByText('Quick Response').closest('div')!;
    expect(tile.parentElement).toHaveClass('grid', 'grid-cols-2');
    expect(tile.parentElement!.children).toHaveLength(4);
    expect(screen.getByRole('link', { name: 'Chat on WhatsApp' }).parentElement).toHaveClass('flex-col', 'sm:flex-row');
  });
});

describe('Part 4 — the navbar logo on mobile', () => {
  it('shows the wordmark at every width (no longer hidden below 760px)', () => {
    render(<Navbar activePath="/" pageLabel="Home" contact={contact} />);

    const wordmark = screen.getByText('GURUJI TRAVEL YATRA');
    expect(wordmark).toHaveClass('whitespace-nowrap');
    expect(wordmark.parentElement!.className).not.toMatch(/\bhidden\b/);
    // Desktop sizes are unchanged from 760px up.
    expect(wordmark).toHaveClass('760:text-[15px]', '760:tracking-[0.06em]');
  });
});

describe('Part 5 — the hero background word', () => {
  it('is the Hindi word, marked as Hindi, decorative, and out of the layout flow', () => {
    render(
      <Hero
        headline={null}
        subtext={null}
        heroImageUrl={undefined}
        stats={{ happyTravellers: undefined, destinations: undefined, yearsExperience: undefined, showFiguresNote: false }}
      />
    );

    const word = screen.getByTestId('hero-background-word');
    expect(word).toHaveTextContent('यात्रा');
    expect(word).toHaveAttribute('lang', 'hi');
    expect(word).toHaveAttribute('aria-hidden', 'true');
    expect(word).toHaveClass('absolute', 'pointer-events-none');
    expect(word.className).not.toMatch(/\bhidden\b/);
    expect(word.className).toContain('var(--font-noto-serif-devanagari)');
    expect(screen.queryByText('YATRA')).not.toBeInTheDocument();
  });
});

describe('Part 6 — the postcards', () => {
  it('renders the six postcards, in order, as one list that becomes a snap row below 768px', () => {
    render(<InstagramStrip instagramUrl="https://www.instagram.com/gurujitravelyatra/" />);

    const row = screen.getByRole('list', { name: 'Postcards' });
    const items = within(row).getAllByRole('listitem');
    expect(items.map((item) => within(item).getByText(/^Postcard \d\d$/).textContent)).toEqual([
      'Postcard 01',
      'Postcard 02',
      'Postcard 03',
      'Postcard 04',
      'Postcard 05',
      'Postcard 06',
    ]);
    expect(row).toHaveClass('max-md:flex', 'max-md:overflow-x-auto', 'max-md:snap-x', 'max-md:snap-mandatory', 'no-scrollbar');
    // Desktop grids are what they were.
    expect(row).toHaveClass('md:grid', 'md:grid-cols-3', 'lg:grid-cols-6');
    for (const item of items) expect(item).toHaveClass('max-md:snap-start', 'max-md:flex-none');
  });

  it('gives every postcard its own tilt and float timing', () => {
    render(<InstagramStrip instagramUrl="https://www.instagram.com/gurujitravelyatra/" />);

    const cards = Array.from(screen.getByTestId('postcard-row').querySelectorAll<HTMLElement>('.postcard-float'));
    expect(cards).toHaveLength(6);
    const delays = cards.map((card) => card.style.getPropertyValue('--postcard-delay'));
    expect(new Set(delays).size).toBe(6);
    for (const card of cards) {
      expect(card.style.getPropertyValue('--postcard-tilt')).toMatch(/deg$/);
      const seconds = parseFloat(card.style.getPropertyValue('--postcard-duration'));
      expect(seconds).toBeGreaterThanOrEqual(4);
      expect(seconds).toBeLessThanOrEqual(6);
    }
  });
});

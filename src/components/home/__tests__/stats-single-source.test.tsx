import { cleanup, render, screen, within } from '@testing-library/react';

import { Hero } from '../Hero';
import { StatsBar } from '../StatsBar';
import { WhyGtyBand } from '../WhyGtyBand';
import { FixtureContentAdapter } from '@/content/adapters/fixture-content-adapter';
import { statMetrics } from '@/content/fixtures/stats.fixture';
import { whyItems } from '@/content/fixtures/whys.fixture';
import type { StatMetric } from '@/content/types';
import { ModalProvider } from '@/components/modals/modal-context';

/**
 * Stats never moved to the database (BLOCKERS.md §5 — only tours, destinations,
 * departures and brochures did), so this asserts against the fixture adapter
 * directly. `PrismaContentAdapter.getStats()` delegates straight back here.
 */
const contentAdapter = new FixtureContentAdapter();

/**
 * `Hero` renders `HeroCtas`, which opens the enquiry modal — so it needs the
 * provider. Nothing in these tests touches the modal itself.
 */
function renderHero(stats: StatMetric[]) {
  return render(
    <ModalProvider>
      <Hero stats={stats} />
    </ModalProvider>
  );
}

/**
 * H3 — two sources of truth for the same numbers, on the same page.
 *
 * `Hero` used to hold its own `HERO_STATS` literal ("10,000+", "150+",
 * "8+ Years") while `StatsBar`, further down the same Home page, rendered
 * `contentAdapter.getStats()`. Editing one would silently contradict the
 * other. The hero now selects from the array it is handed.
 */
const FAKE_STATS: StatMetric[] = [
  { icon: '☺', value: '42,000+', label: 'Happy Travellers' },
  { icon: '◍', value: '7+', label: 'Destinations' },
  { icon: '☰', value: '99+', label: 'Group Tours' },
  { icon: '✷', value: '3+', label: 'Years of Experience' },
  { icon: '♥', value: '77%', label: 'Traveller Satisfaction' },
];

describe('Hero and StatsBar share one stats source', () => {
  it('both render values from the SAME array they are given — neither has its own literals', () => {
    const { unmount } = renderHero(FAKE_STATS);
    const heroStrip = screen.getByTestId('hero-stats');

    // If the hero still hardcoded its numbers, these substituted values could
    // not appear and the real fixture values would show instead.
    expect(within(heroStrip).getByText(/42,000\+/)).toBeInTheDocument();
    expect(within(heroStrip).getByText(/7\+/)).toBeInTheDocument();
    expect(heroStrip.textContent).not.toMatch(/10,000\+|150\+/);
    unmount();

    render(<StatsBar stats={FAKE_STATS} />);
    const bar = screen.getByTestId('section-11-stats');
    expect(within(bar).getByText(/42,000\+/)).toBeInTheDocument();
    expect(bar.textContent).not.toMatch(/10,000\+/);
  });

  it('every figure the hero shows comes from the canonical stats list', async () => {
    const stats = await contentAdapter.getStats();
    renderHero(stats);

    const canonicalValues = new Set(stats.map((stat) => stat.value));
    const heroStrip = screen.getByTestId('hero-stats');
    const figures = within(heroStrip)
      .getAllByText(/\d/)
      .map((node) => node.textContent?.replace('*', '').trim() ?? '');

    const shownValues = figures.filter((figure) => canonicalValues.has(figure));
    expect(shownValues.length).toBeGreaterThan(0);
    for (const figure of figures) {
      // Every number-bearing node in the strip is either a canonical value or
      // the label beneath it — never an independently-typed figure.
      const isCanonical = canonicalValues.has(figure);
      const isLabel = stats.some((stat) => stat.label === figure);
      expect(isCanonical || isLabel).toBe(true);
    }
  });

  it('renders no stats at all rather than inventing them when the list is empty', () => {
    renderHero([]);
    expect(screen.getByTestId('hero-stats').textContent).toBe('');
  });

  it('falls back to the first three stats if the preferred labels are absent', () => {
    const renamed: StatMetric[] = [
      { icon: 'a', value: '1', label: 'Alpha' },
      { icon: 'b', value: '2', label: 'Beta' },
      { icon: 'c', value: '3', label: 'Gamma' },
      { icon: 'd', value: '4', label: 'Delta' },
    ];
    renderHero(renamed);
    const strip = screen.getByTestId('hero-stats');

    expect(within(strip).getByText('Alpha')).toBeInTheDocument();
    expect(within(strip).queryByText('Delta')).not.toBeInTheDocument();
  });
});

/**
 * H2 — the figures conflict with the spec and with each other, and "98%
 * Traveller Satisfaction" is a factual claim with no review data behind it.
 * They ship marked, the same way testimonials do.
 */
describe('placeholder stats are visibly marked', () => {
  it('marks every placeholder stat and shows the footnote', () => {
    render(<StatsBar stats={statMetrics} />);

    for (const stat of statMetrics) {
      expect(screen.getByTestId(`stat-placeholder-marker-${stat.label}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId('stats-placeholder-note')).toHaveTextContent(/pending confirmation/i);
  });

  it('marks NO stat and shows no footnote when every figure is confirmed', () => {
    render(<StatsBar stats={FAKE_STATS} />);

    for (const stat of FAKE_STATS) {
      expect(screen.queryByTestId(`stat-placeholder-marker-${stat.label}`)).not.toBeInTheDocument();
    }
    expect(screen.queryByTestId('stats-placeholder-note')).not.toBeInTheDocument();
  });

  it('marks only the unconfirmed figures in a mixed list', () => {
    const mixed: StatMetric[] = [
      { icon: '☺', value: '10,000+', label: 'Happy Travellers', isPlaceholder: true },
      { icon: '◍', value: '150+', label: 'Destinations' },
    ];
    render(<StatsBar stats={mixed} />);

    expect(screen.getByTestId('stat-placeholder-marker-Happy Travellers')).toBeInTheDocument();
    expect(screen.queryByTestId('stat-placeholder-marker-Destinations')).not.toBeInTheDocument();
    expect(screen.getByTestId('stats-placeholder-note')).toBeInTheDocument();
  });

  it('keeps the asterisk out of the accessible text, describing the group with the footnote instead', () => {
    render(<StatsBar stats={statMetrics} />);

    const marker = screen.getByTestId('stat-placeholder-marker-Happy Travellers');
    expect(marker).toHaveAttribute('aria-hidden', 'true');
    expect(document.getElementById('stats-placeholder-note')).toBeInTheDocument();
  });

  it('marks the hero strip too, since it shows the same unconfirmed figures', () => {
    renderHero(statMetrics);

    expect(screen.getByTestId('hero-stat-placeholder-Happy Travellers')).toBeInTheDocument();
    expect(screen.getByTestId('hero-stats-placeholder-note')).toHaveTextContent(/pending confirmation/i);
  });

  it('leaves the hero unmarked when the figures are confirmed', () => {
    renderHero(FAKE_STATS);

    expect(screen.queryByTestId('hero-stat-placeholder-Happy Travellers')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hero-stats-placeholder-note')).not.toBeInTheDocument();
  });
});

/** H3 — the third variant of the same number, in the "Why Travel With GTY?" band. */
describe('WhyGtyBand quotes the canonical years figure', () => {
  it('composes its trust title from the stats fixture rather than its own literal', () => {
    const years = statMetrics.find((stat) => stat.label === 'Years of Experience');
    expect(years).toBeDefined();

    const trustItem = whyItems.find((item) => item.title.includes('Trusted Since'));
    expect(trustItem?.title).toBe(`Trusted Since ${years!.value} Years`);
  });

  it('marks that figure as a placeholder, exactly as the stats bar does', () => {
    render(<WhyGtyBand />);

    expect(screen.getByTestId('why-placeholder-marker-Trusted Since 8+ Years')).toBeInTheDocument();
    expect(screen.getByTestId('why-placeholder-note')).toHaveTextContent(/pending confirmation/i);
  });

  it('marks nothing else in the band', () => {
    render(<WhyGtyBand />);

    const marked = whyItems.filter((item) => item.isPlaceholder);
    expect(marked).toHaveLength(1);
  });
});

/**
 * F2 — the placeholder marking has to REACH assistive tech, on all three
 * surfaces, in the same way.
 *
 * `StatsBar` was the only one that got this right. `WhyGtyBand` rendered its
 * asterisk `aria-hidden` but gave the footnote no `id`, so nothing could point
 * at it — the marker was suppressed for screen readers AND the explanation was
 * never associated, leaving an unconfirmed figure reading as settled fact.
 * `Hero` had neither half, plus a 9px white footnote sitting directly on a
 * photograph.
 *
 * These tests assert the three pieces together, per surface, because any one of
 * them alone is worthless: a visible asterisk, an `id` on the footnote, and an
 * `aria-describedby` on a ROLED container that resolves to that exact id. (The
 * role matters: `aria-describedby` on a bare `<div>` is routinely ignored.)
 */
describe('placeholder footnotes are wired to the figures they explain', () => {
  interface Surface {
    name: string;
    render: () => void;
    groupLabel: string;
    noteTestId: string;
    markerTestId: string;
  }

  const surfaces: Surface[] = [
    {
      name: 'StatsBar',
      render: () => void render(<StatsBar stats={statMetrics} />),
      groupLabel: 'Guruji Travel Yatra in numbers',
      noteTestId: 'stats-placeholder-note',
      markerTestId: 'stat-placeholder-marker-Happy Travellers',
    },
    {
      name: 'WhyGtyBand',
      render: () => void render(<WhyGtyBand />),
      groupLabel: 'Why travel with GTY',
      noteTestId: 'why-placeholder-note',
      markerTestId: 'why-placeholder-marker-Trusted Since 8+ Years',
    },
    {
      name: 'Hero',
      render: () => void renderHero(statMetrics),
      groupLabel: 'Guruji Travel Yatra in numbers',
      noteTestId: 'hero-stats-placeholder-note',
      markerTestId: 'hero-stat-placeholder-Happy Travellers',
    },
  ];

  for (const surface of surfaces) {
    describe(surface.name, () => {
      it('gives the footnote a real id', () => {
        surface.render();
        const note = screen.getByTestId(surface.noteTestId);

        expect(note.id).not.toBe('');
        expect(document.getElementById(note.id)).toBe(note);
      });

      it('points the marked figures at that id via aria-describedby on a roled group', () => {
        surface.render();
        const note = screen.getByTestId(surface.noteTestId);
        const group = screen.getByRole('group', { name: surface.groupLabel });

        expect(group).toHaveAttribute('aria-describedby', note.id);
        // The reference must RESOLVE — a dangling id is the bug this catches.
        expect(document.getElementById(group.getAttribute('aria-describedby')!)).toBe(note);
      });

      it('keeps the asterisk on screen while hiding it from the screen reader, exactly as StatsBar does', () => {
        surface.render();
        const marker = screen.getByTestId(surface.markerTestId);

        expect(marker).toBeVisible();
        expect(marker).toHaveTextContent('*');
        // Announced as the footnote via aria-describedby, never as a bare "*".
        expect(marker).toHaveAttribute('aria-hidden', 'true');
      });

      it('drops the aria-describedby entirely when there is no footnote to point at', () => {
        // Only the data-driven surfaces can be handed confirmed figures;
        // `WhyGtyBand` reads the fixture directly and is covered by the
        // "marks nothing else in the band" test above.
        if (surface.name === 'WhyGtyBand') return;

        if (surface.name === 'Hero') renderHero(FAKE_STATS);
        else render(<StatsBar stats={FAKE_STATS} />);

        expect(screen.queryByTestId(surface.noteTestId)).not.toBeInTheDocument();
        expect(screen.getByRole('group', { name: surface.groupLabel })).not.toHaveAttribute('aria-describedby');
      });
    });
  }

  it('uses the SAME three-part pattern on every surface — no bespoke variant', () => {
    for (const surface of surfaces) {
      surface.render();

      const note = screen.getByTestId(surface.noteTestId);
      const group = screen.getByRole('group', { name: surface.groupLabel });

      expect(note.tagName).toBe('P');
      expect(group.getAttribute('aria-describedby')).toBe(note.id);
      expect(note).toHaveTextContent(/pending confirmation/i);

      cleanup();
    }
  });

  it("renders the hero's footnote at readable size, not the 9px overlay it used to be", () => {
    renderHero(statMetrics);
    const note = screen.getByTestId('hero-stats-placeholder-note');

    // It sits on a photograph, so it may not be the 9px white text it was —
    // it now uses the same white-card + subtle-ink treatment as the stat chips
    // beside it, which is the only other overlay element in that corner.
    expect(note.className).not.toMatch(/\btext-9\b/);
    expect(note.className).toMatch(/\btext-11\b/);
    expect(note.className).toMatch(/bg-gty-white/);
    expect(note.className).toMatch(/text-gty-subtle/);
  });
});

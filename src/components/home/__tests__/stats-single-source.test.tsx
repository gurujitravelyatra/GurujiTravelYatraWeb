import { cleanup, render, screen, within } from '@testing-library/react';

import { Hero } from '../Hero';
import { StatsBar } from '../StatsBar';
import { WhyGtyBand } from '../WhyGtyBand';
import { FixtureContentAdapter } from '@/content/adapters/fixture-content-adapter';
import { siteStatsSummary, statMetrics } from '@/content/fixtures/stats.fixture';
import { whyItems } from '@/content/fixtures/whys.fixture';
import type { SiteStatsSummary, StatMetric } from '@/content/types';
import { ModalProvider } from '@/components/modals/modal-context';

/**
 * Stats never moved to the database (BLOCKERS.md §5 — only tours, destinations,
 * departures and brochures did), so this asserts against the fixture adapter
 * directly. `PrismaContentAdapter.getStats()`/`getSiteStatsSummary()` delegate
 * straight back here.
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
 *
 * CRM-migration decision 3 redesigned `StatsBar` to take a `SiteStatsSummary`
 * (the CRM's `/public/site` shape) instead of the same `StatMetric[]` array
 * `Hero` reads — the two components no longer share one literal prop value,
 * but they still share one SOURCE: `siteStatsSummary` (`stats.fixture.ts`) is
 * derived from `statMetrics` via `getStatByLabel`, so the two cannot disagree
 * while both exist, and the swap to a live CRM touches only the adapter, not
 * either component.
 */
const FAKE_STATS: StatMetric[] = [
  { icon: '☺', value: '42,000+', label: 'Happy Travellers' },
  { icon: '◍', value: '7+', label: 'Destinations' },
  { icon: '☰', value: '99+', label: 'Group Tours' },
  { icon: '✷', value: '3+', label: 'Years of Experience' },
  { icon: '♥', value: '77%', label: 'Traveller Satisfaction' },
];

const FAKE_SITE_STATS: SiteStatsSummary = {
  happyTravellers: '42,000+',
  destinations: '7+',
  yearsExperience: '3+',
  showFiguresNote: false,
};

describe('Hero renders values from the array it is given — no literal of its own', () => {
  it('shows substituted values and never the hardcoded ones', () => {
    const { unmount } = renderHero(FAKE_STATS);
    const heroStrip = screen.getByTestId('hero-stats');

    expect(within(heroStrip).getByText(/42,000\+/)).toBeInTheDocument();
    expect(within(heroStrip).getByText(/7\+/)).toBeInTheDocument();
    expect(heroStrip.textContent).not.toMatch(/10,000\+|150\+/);
    unmount();
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
 * CRM-migration decision 3 — `StatsBar` redesigned to the CRM's 3-figure
 * `/public/site` shape. These replace the old tests that fed it the full
 * 5-item `StatMetric[]` array.
 */
describe('StatsBar renders only the 3 CRM-shaped figures it is given', () => {
  it('renders Happy Travellers, Destinations and Years of Experience verbatim', async () => {
    render(<StatsBar stats={FAKE_SITE_STATS} />);
    const bar = screen.getByTestId('section-11-stats');

    expect(within(bar).getByText('42,000+')).toBeInTheDocument();
    expect(within(bar).getByText('Happy Travellers')).toBeInTheDocument();
    expect(within(bar).getByText('7+')).toBeInTheDocument();
    expect(within(bar).getByText('Destinations')).toBeInTheDocument();
    expect(within(bar).getByText('3+')).toBeInTheDocument();
    expect(within(bar).getByText('Years of Experience')).toBeInTheDocument();
  });

  it('is fed by the SAME canonical fixture Hero reads', async () => {
    render(<StatsBar stats={siteStatsSummary} />);
    const bar = screen.getByTestId('section-11-stats');

    const happyTravellers = statMetrics.find((stat) => stat.label === 'Happy Travellers')!;
    const destinations = statMetrics.find((stat) => stat.label === 'Destinations')!;
    const yearsOfExperience = statMetrics.find((stat) => stat.label === 'Years of Experience')!;

    expect(within(bar).getByText(happyTravellers.value)).toBeInTheDocument();
    expect(within(bar).getByText(destinations.value)).toBeInTheDocument();
    expect(within(bar).getByText(yearsOfExperience.value)).toBeInTheDocument();
  });

  it('never renders "Group Tours" or "Traveller Satisfaction" — there is no CRM field for either', () => {
    render(<StatsBar stats={siteStatsSummary} />);

    expect(screen.queryByText('Group Tours')).not.toBeInTheDocument();
    expect(screen.queryByText('Traveller Satisfaction')).not.toBeInTheDocument();
  });

  it('hides a stat instead of rendering a blank box when its value is absent', () => {
    render(<StatsBar stats={{ happyTravellers: '10,000+', showFiguresNote: false }} />);
    const bar = screen.getByTestId('section-11-stats');

    expect(within(bar).getByText('10,000+')).toBeInTheDocument();
    expect(within(bar).queryByText('Destinations')).not.toBeInTheDocument();
    expect(within(bar).queryByText('Years of Experience')).not.toBeInTheDocument();
  });

  it('renders nothing at all — not an empty band — when every figure is absent', () => {
    const { container } = render(<StatsBar stats={{ showFiguresNote: false }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the asterisk and footnote on every figure when showFiguresNote is true', () => {
    render(<StatsBar stats={siteStatsSummary} />);

    expect(screen.getByTestId('stat-placeholder-marker-happyTravellers')).toBeInTheDocument();
    expect(screen.getByTestId('stat-placeholder-marker-destinations')).toBeInTheDocument();
    expect(screen.getByTestId('stat-placeholder-marker-yearsExperience')).toBeInTheDocument();
    expect(screen.getByTestId('stats-placeholder-note')).toHaveTextContent(/pending confirmation/i);
  });

  it('shows no marker and no footnote when showFiguresNote is false', () => {
    render(<StatsBar stats={FAKE_SITE_STATS} />);

    expect(screen.queryByTestId('stat-placeholder-marker-happyTravellers')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stats-placeholder-note')).not.toBeInTheDocument();
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
 * F2 — the placeholder marking has to REACH assistive tech, on all surfaces
 * that have one, in the same way.
 *
 * `WhyGtyBand` used to render its asterisk `aria-hidden` but give the
 * footnote no `id`, so nothing could point at it — the marker was suppressed
 * for screen readers AND the explanation was never associated, leaving an
 * unconfirmed figure reading as settled fact. `Hero` had neither half, plus a
 * 9px white footnote sitting directly on a photograph. `StatsBar` is covered
 * by its own describe block above (its marker ids changed under decision 3);
 * this block keeps asserting the shared three-part pattern on the two
 * surfaces whose contract did not change.
 *
 * These tests assert the three pieces together, per surface, because any one
 * of them alone is worthless: a visible asterisk, an `id` on the footnote,
 * and an `aria-describedby` on a ROLED container that resolves to that exact
 * id. (The role matters: `aria-describedby` on a bare `<div>` is routinely
 * ignored.)
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
        // Only Hero can be handed confirmed figures here; `WhyGtyBand` reads
        // the fixture directly and is covered by the "marks nothing else in
        // the band" test above.
        if (surface.name === 'WhyGtyBand') return;

        renderHero(FAKE_STATS);

        expect(screen.queryByTestId(surface.noteTestId)).not.toBeInTheDocument();
        expect(screen.getByRole('group', { name: surface.groupLabel })).not.toHaveAttribute('aria-describedby');
      });
    });
  }

  it('StatsBar drops the aria-describedby entirely when showFiguresNote is false', () => {
    render(<StatsBar stats={FAKE_SITE_STATS} />);

    expect(screen.queryByTestId('stats-placeholder-note')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Guruji Travel Yatra in numbers' })).not.toHaveAttribute(
      'aria-describedby'
    );
  });

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

    render(<StatsBar stats={siteStatsSummary} />);
    const statsNote = screen.getByTestId('stats-placeholder-note');
    const statsGroup = screen.getByRole('group', { name: 'Guruji Travel Yatra in numbers' });
    expect(statsNote.tagName).toBe('P');
    expect(statsGroup.getAttribute('aria-describedby')).toBe(statsNote.id);
    expect(statsNote).toHaveTextContent(/pending confirmation/i);
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

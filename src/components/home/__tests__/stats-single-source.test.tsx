import { cleanup, render, screen, within } from '@testing-library/react';

import { Hero } from '../Hero';
import { StatsBar } from '../StatsBar';
import { WhyGtyBand } from '../WhyGtyBand';
import type { SiteStatsSummary } from '@/lib/site-stats';
import { ModalProvider } from '@/components/modals/modal-context';

/**
 * CRM-migration Step 2/3 — `Hero` and `StatsBar` both now read the SAME
 * `SiteStatsSummary` (from `GET /public/site`'s settings), replacing the old
 * `StatMetric[]` list both components used to select from independently.
 * `WhyGtyBand` reads a single `yearsExperienceLabel` string. The old per-stat
 * `isPlaceholder` marker system is retired (CRM-migration decision 1/3): a
 * single `showFiguresNote` flag now gates the asterisk+footnote on both
 * `Hero` and `StatsBar`, and `WhyGtyBand` has no marker at all — a value the
 * CRM Owner actually typed needs no "unconfirmed" caveat.
 */
function renderHero(stats: SiteStatsSummary, headline: string | null = null, subtext: string | null = null) {
  return render(
    <ModalProvider>
      <Hero headline={headline} subtext={subtext} stats={stats} />
    </ModalProvider>
  );
}

const CONFIRMED_STATS: SiteStatsSummary = {
  happyTravellers: '42,000+',
  destinations: '7+',
  yearsExperience: '3+',
  showFiguresNote: false,
};

const UNCONFIRMED_STATS: SiteStatsSummary = {
  happyTravellers: '10,000+',
  destinations: '150+',
  yearsExperience: '8+',
  showFiguresNote: true,
};

describe('Hero renders the SiteStatsSummary it is given — no literal of its own', () => {
  it('shows the given values', () => {
    renderHero(CONFIRMED_STATS);
    const heroStrip = screen.getByTestId('hero-stats');

    expect(within(heroStrip).getByText('42,000+')).toBeInTheDocument();
    expect(within(heroStrip).getByText('7+')).toBeInTheDocument();
    expect(within(heroStrip).getByText('3+')).toBeInTheDocument();
  });

  it('renders no stats strip at all rather than inventing one when every figure is absent', () => {
    renderHero({ showFiguresNote: false });
    expect(screen.queryByTestId('hero-stats')).not.toBeInTheDocument();
  });

  it('omits a single absent figure rather than rendering a blank card', () => {
    renderHero({ destinations: '50+', showFiguresNote: false });
    const heroStrip = screen.getByTestId('hero-stats');

    expect(within(heroStrip).getByText('50+')).toBeInTheDocument();
    expect(within(heroStrip).queryByText('Happy Travellers')).not.toBeInTheDocument();
    expect(within(heroStrip).queryByText('Years of Experience')).not.toBeInTheDocument();
  });

  it('renders the CRM headline/subtext when set, and a real default otherwise', () => {
    renderHero(CONFIRMED_STATS, 'Real CRM Headline', 'Real CRM subtext.');
    expect(screen.getByText('Real CRM Headline')).toBeInTheDocument();
    expect(screen.getByText('Real CRM subtext.')).toBeInTheDocument();
  });

  it('falls back to default copy when the CRM has not set a headline/subtext yet', () => {
    renderHero(CONFIRMED_STATS, null, null);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});

describe('StatsBar renders only the 3 CRM-shaped figures it is given', () => {
  it('renders Happy Travellers, Destinations and Years of Experience verbatim', () => {
    render(<StatsBar stats={CONFIRMED_STATS} />);
    const bar = screen.getByTestId('section-11-stats');

    expect(within(bar).getByText('42,000+')).toBeInTheDocument();
    expect(within(bar).getByText('Happy Travellers')).toBeInTheDocument();
    expect(within(bar).getByText('7+')).toBeInTheDocument();
    expect(within(bar).getByText('Destinations')).toBeInTheDocument();
    expect(within(bar).getByText('3+')).toBeInTheDocument();
    expect(within(bar).getByText('Years of Experience')).toBeInTheDocument();
  });

  it('never renders "Group Tours" or "Traveller Satisfaction" — there is no CRM field for either', () => {
    render(<StatsBar stats={CONFIRMED_STATS} />);

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
    render(<StatsBar stats={UNCONFIRMED_STATS} />);

    expect(screen.getByTestId('stat-placeholder-marker-happyTravellers')).toBeInTheDocument();
    expect(screen.getByTestId('stat-placeholder-marker-destinations')).toBeInTheDocument();
    expect(screen.getByTestId('stat-placeholder-marker-yearsExperience')).toBeInTheDocument();
    expect(screen.getByTestId('stats-placeholder-note')).toHaveTextContent(/pending confirmation/i);
  });

  it('shows no marker and no footnote when showFiguresNote is false', () => {
    render(<StatsBar stats={CONFIRMED_STATS} />);

    expect(screen.queryByTestId('stat-placeholder-marker-happyTravellers')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stats-placeholder-note')).not.toBeInTheDocument();
  });
});

describe('WhyGtyBand quotes the CRM years-of-experience figure directly, with no placeholder marker', () => {
  it('renders "Trusted Since X Years" when the CRM has set a figure', () => {
    render(<WhyGtyBand yearsExperienceLabel="8+" />);
    expect(screen.getByText('Trusted Since 8+ Years')).toBeInTheDocument();
  });

  it('falls back to figure-free copy when the CRM has not set one, rather than guessing a number', () => {
    render(<WhyGtyBand yearsExperienceLabel={null} />);
    expect(screen.getByText('Trusted For Years')).toBeInTheDocument();
    expect(screen.queryByText(/Trusted Since/)).not.toBeInTheDocument();
  });

  it('renders no placeholder asterisk or footnote — a CRM-confirmed value needs no caveat', () => {
    render(<WhyGtyBand yearsExperienceLabel="8+" />);
    expect(screen.queryByText('*')).not.toBeInTheDocument();
    expect(screen.queryByTestId('why-placeholder-note')).not.toBeInTheDocument();
  });
});

/**
 * F2 — the placeholder marking has to REACH assistive tech, on every surface
 * that still has one (`WhyGtyBand` no longer does — see above). `Hero` and
 * `StatsBar` share the exact same `showFiguresNote`-driven pattern now.
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
      render: () => void render(<StatsBar stats={UNCONFIRMED_STATS} />),
      groupLabel: 'Guruji Travel Yatra in numbers',
      noteTestId: 'stats-placeholder-note',
      markerTestId: 'stat-placeholder-marker-happyTravellers',
    },
    {
      name: 'Hero',
      render: () => void renderHero(UNCONFIRMED_STATS),
      groupLabel: 'Guruji Travel Yatra in numbers',
      noteTestId: 'hero-stats-placeholder-note',
      markerTestId: 'hero-stat-placeholder-happyTravellers',
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
        expect(document.getElementById(group.getAttribute('aria-describedby')!)).toBe(note);
      });

      it('keeps the asterisk on screen while hiding it from the screen reader', () => {
        surface.render();
        const marker = screen.getByTestId(surface.markerTestId);

        expect(marker).toBeVisible();
        expect(marker).toHaveTextContent('*');
        expect(marker).toHaveAttribute('aria-hidden', 'true');
      });

      it('drops the aria-describedby entirely when showFiguresNote is false', () => {
        cleanup();
        if (surface.name === 'Hero') renderHero(CONFIRMED_STATS);
        else render(<StatsBar stats={CONFIRMED_STATS} />);

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
});

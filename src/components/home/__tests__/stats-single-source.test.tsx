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

/**
 * `CountUpStat` (brief §A6, 2026-11-14) splits a value like "42,000+" into
 * a number text node plus a separately-coloured suffix `<span>` — real for
 * sighted/assistive-tech users (the full accessible text still reads
 * "42,000+"), but `@testing-library/dom`'s default `getByText` matches a
 * node's OWN direct text-node children only, not descendant elements', so
 * it can no longer find the two pieces as one string. `toHaveTextContent`
 * (full `element.textContent`, descendants included) is the correct tool
 * for a value now split across elements.
 */
function getStatValueNode(container: HTMLElement, text: string): HTMLElement {
  return within(container).getByText((_, element) => element?.textContent === text);
}

describe('Hero renders the SiteStatsSummary it is given — no literal of its own', () => {
  it('shows the given values', () => {
    renderHero(CONFIRMED_STATS);
    const heroStrip = screen.getByTestId('hero-stats');

    expect(getStatValueNode(heroStrip, '42,000+')).toBeInTheDocument();
    expect(getStatValueNode(heroStrip, '7+')).toBeInTheDocument();
    expect(getStatValueNode(heroStrip, '3+')).toBeInTheDocument();
  });

  it('renders no stats strip at all rather than inventing one when every figure is absent', () => {
    renderHero({ showFiguresNote: false });
    expect(screen.queryByTestId('hero-stats')).not.toBeInTheDocument();
  });

  it('omits a single absent figure rather than rendering a blank card', () => {
    renderHero({ destinations: '50+', showFiguresNote: false });
    const heroStrip = screen.getByTestId('hero-stats');

    expect(getStatValueNode(heroStrip, '50+')).toBeInTheDocument();
    expect(within(heroStrip).queryByText('Happy Travellers')).not.toBeInTheDocument();
    expect(within(heroStrip).queryByText('Years of Experience')).not.toBeInTheDocument();
  });

  /**
   * Brief §A3/§A4 (2026-11-14): a real CRM headline is now ALWAYS split
   * across the hero's two masked lines with the last word red-italic
   * (reversing the earlier "never impose this on Owner-typed text"
   * decision), and the subtext line is fixed copy — a real CRM subtext
   * value must NOT override it anymore (reversing the earlier CRM-sourced
   * subtext decision). Both reversals are the brief's own explicit
   * instruction ("this prompt wins" over the earlier design).
   */
  it('splits a real CRM headline across two lines with the last word accented, and always shows the fixed subtext copy', () => {
    renderHero(CONFIRMED_STATS, 'Real CRM Headline', 'Real CRM subtext.');
    const heading = screen.getByRole('heading', { level: 1 });

    expect(heading).toHaveTextContent('Real CRM Headline');
    expect(screen.getByText('Headline')).toHaveClass('italic');
    expect(screen.queryByText('Real CRM subtext.')).not.toBeInTheDocument();
    expect(screen.getByText(/touch your soul and memories/)).toBeInTheDocument();
  });

  /**
   * New brief, Part 2 (2026-11-14): "add a safe default if the value is
   * shorter than 2 words" — a real-but-too-short CRM value (the Owner
   * testing with "test") must not attempt a degenerate 1-word split.
   */
  it('falls back to the default two-line headline when the real CRM value is a single word', () => {
    renderHero(CONFIRMED_STATS, 'test', null);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Journeys That Stay Forever.');
    expect(screen.queryByText('test')).not.toBeInTheDocument();
  });

  /**
   * New brief, Part 2 (2026-11-14): "no ImagePlaceholder in the hero ever"
   * — unlike every other photo slot, the hero must never fall through to
   * `PhotoPlaceholder`'s grey box + text label, even when no CRM image is
   * configured at all.
   */
  it('never shows an ImagePlaceholder label in the hero, with or without a CRM image', () => {
    renderHero(CONFIRMED_STATS);
    expect(screen.queryByText('Himalayas')).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /image placeholder/i })).not.toBeInTheDocument();
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

describe('WhyGtyBand quotes the CRM years-of-experience figure directly, with no placeholder marker on the pillar', () => {
  it('renders "Trusted Since X Years" when the CRM has set a figure', () => {
    render(<WhyGtyBand stats={{ yearsExperience: '8+', showFiguresNote: false }} />);
    expect(screen.getByText('Trusted Since 8+ Years')).toBeInTheDocument();
  });

  it('falls back to figure-free copy when the CRM has not set one, rather than guessing a number', () => {
    render(<WhyGtyBand stats={{ showFiguresNote: false }} />);
    expect(screen.getByText('Trusted For Years')).toBeInTheDocument();
    expect(screen.queryByText(/Trusted Since/)).not.toBeInTheDocument();
  });

  it('renders no placeholder asterisk on the pillar title itself — a CRM-confirmed value needs no caveat', () => {
    render(<WhyGtyBand stats={{ yearsExperience: '8+', showFiguresNote: false }} />);
    expect(screen.getByText('Trusted Since 8+ Years')).not.toHaveTextContent('*');
  });
});

/**
 * "Redux" redesign (brief §8, 2026-11-14): the stats band that used to be
 * the separate `<StatsBar>` section is now rendered INSIDE `WhyGtyBand`
 * (reading the exact same `stats` object `Hero` reads) — `StatsBar` the
 * component is untouched and still renders unchanged on `/about-us`, so its
 * own describe block above is unaffected. This mirrors that block's
 * coverage for the new location.
 */
describe("WhyGtyBand's stats band renders only the 3 CRM-shaped figures it is given", () => {
  it('renders Happy Travellers, Destinations and Years of Experience verbatim', () => {
    render(<WhyGtyBand stats={CONFIRMED_STATS} />);
    const band = screen.getByRole('group', { name: 'Guruji Travel Yatra in numbers' });

    expect(getStatValueNode(band, '42,000+')).toBeInTheDocument();
    expect(within(band).getByText('Happy Travellers')).toBeInTheDocument();
    expect(getStatValueNode(band, '7+')).toBeInTheDocument();
    expect(within(band).getByText('Destinations')).toBeInTheDocument();
    expect(getStatValueNode(band, '3+')).toBeInTheDocument();
    expect(within(band).getByText('Years of Experience')).toBeInTheDocument();
  });

  it('hides a stat instead of rendering a blank box when its value is absent', () => {
    render(<WhyGtyBand stats={{ happyTravellers: '10,000+', showFiguresNote: false }} />);
    const band = screen.getByRole('group', { name: 'Guruji Travel Yatra in numbers' });

    expect(getStatValueNode(band, '10,000+')).toBeInTheDocument();
    expect(within(band).queryByText('Destinations')).not.toBeInTheDocument();
    expect(within(band).queryByText('Years of Experience')).not.toBeInTheDocument();
  });

  it('renders no stats band at all — not an empty one — when every figure is absent', () => {
    render(<WhyGtyBand stats={{ showFiguresNote: false }} />);
    expect(screen.queryByRole('group', { name: 'Guruji Travel Yatra in numbers' })).not.toBeInTheDocument();
  });

  it('shows the asterisk and footnote on every figure when showFiguresNote is true', () => {
    render(<WhyGtyBand stats={UNCONFIRMED_STATS} />);

    expect(screen.getByTestId('why-gty-stat-placeholder-happyTravellers')).toBeInTheDocument();
    expect(screen.getByTestId('why-gty-stat-placeholder-destinations')).toBeInTheDocument();
    expect(screen.getByTestId('why-gty-stat-placeholder-yearsExperience')).toBeInTheDocument();
    expect(screen.getByTestId('why-gty-stats-placeholder-note')).toHaveTextContent(/pending confirmation/i);
  });

  it('shows no marker and no footnote when showFiguresNote is false', () => {
    render(<WhyGtyBand stats={CONFIRMED_STATS} />);

    expect(screen.queryByTestId('why-gty-stat-placeholder-happyTravellers')).not.toBeInTheDocument();
    expect(screen.queryByTestId('why-gty-stats-placeholder-note')).not.toBeInTheDocument();
  });
});

/**
 * F2 — the placeholder marking has to REACH assistive tech, on every surface
 * that has one. `StatsBar`, `Hero` and `WhyGtyBand`'s stats band (which
 * replaced the pillar-title asterisk this section used to carry — see the
 * describe block above) all share the exact same `showFiguresNote`-driven
 * pattern.
 */
describe('placeholder footnotes are wired to the figures they explain', () => {
  interface Surface {
    name: string;
    render: () => void;
    renderConfirmed: () => void;
    groupLabel: string;
    noteTestId: string;
    markerTestId: string;
  }

  const surfaces: Surface[] = [
    {
      name: 'StatsBar',
      render: () => void render(<StatsBar stats={UNCONFIRMED_STATS} />),
      renderConfirmed: () => void render(<StatsBar stats={CONFIRMED_STATS} />),
      groupLabel: 'Guruji Travel Yatra in numbers',
      noteTestId: 'stats-placeholder-note',
      markerTestId: 'stat-placeholder-marker-happyTravellers',
    },
    {
      name: 'Hero',
      render: () => void renderHero(UNCONFIRMED_STATS),
      renderConfirmed: () => void renderHero(CONFIRMED_STATS),
      groupLabel: 'Guruji Travel Yatra in numbers',
      noteTestId: 'hero-stats-placeholder-note',
      markerTestId: 'hero-stat-placeholder-happyTravellers',
    },
    {
      name: "WhyGtyBand's stats band",
      render: () => void render(<WhyGtyBand stats={UNCONFIRMED_STATS} />),
      renderConfirmed: () => void render(<WhyGtyBand stats={CONFIRMED_STATS} />),
      groupLabel: 'Guruji Travel Yatra in numbers',
      noteTestId: 'why-gty-stats-placeholder-note',
      markerTestId: 'why-gty-stat-placeholder-happyTravellers',
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
        surface.renderConfirmed();

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

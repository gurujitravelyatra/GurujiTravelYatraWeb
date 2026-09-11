import { render, screen } from '@testing-library/react';

import { AboutStory } from '../AboutStory';
import { AboutTimeline } from '../AboutTimeline';
import { AboutTravellers } from '../AboutTravellers';
import { AboutCta } from '../AboutCta';
import { aboutMilestones } from '@/content/fixtures/about.fixture';

jest.mock('@/components/modals/modal-context', () => ({
  useModal: () => ({ modal: null, openEnquiry: jest.fn(), openBrochure: jest.fn(), close: jest.fn() }),
}));

/**
 * BLOCKERS.md Decision H: product-spec §5.8's "team section (optional)" and
 * "certifications ... if applicable" are both DELIBERATELY skipped, not
 * rendered as empty shells — nobody at GTY provided a team roster, employee
 * names/photos or certification badges, and inventing any of that for a real
 * travel brand is exactly the failure mode this guards against. This must
 * keep failing (i.e. stay green) if a future pass "completes" the About Us
 * page by adding a team or certifications section.
 */
/**
 * Anchored to the START of an element's text, not a substring sweep.
 * A team-member credit renders the role as its own label ("Founder",
 * "Co-Founder & CEO", "Director — Operations"), so `^` catches every real
 * instance. A bare substring match would instead fail on AboutStory's honest
 * placeholder copy, which says that "no founder note ... has been provided"
 * — i.e. on the very sentence that proves nothing was invented.
 */
const ROLE_LABEL = /^(founder|co-?founder|ceo|managing director|director)\b/i;

describe('About Us page renders no invented team or certification section', () => {
  function renderAboutUsComposition() {
    render(
      <>
        <AboutStory />
        <AboutTimeline milestones={aboutMilestones} />
        <AboutTravellers />
        <AboutCta />
      </>
    );
  }

  it('renders no team-member section, names, roles or headshots', () => {
    renderAboutUsComposition();

    expect(screen.queryByText(/our team/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/meet the team/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /team/i })).not.toBeInTheDocument();
    expect(screen.queryAllByText(ROLE_LABEL)).toHaveLength(0);

    // No headshots either: every image slot on this page is a photo of a place
    // or of unnamed travellers, never a person presented as a named staff
    // member. `PhotoPlaceholder` exposes its alt text as the image's
    // accessible name, so a fabricated credit would surface here.
    for (const image of screen.queryAllByRole('img')) {
      expect(image).not.toHaveAccessibleName(ROLE_LABEL);
    }
  });

  it('renders no certifications, accreditations or trust-badge section', () => {
    renderAboutUsComposition();

    expect(screen.queryByText(/certifi(ed|cation)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/accredited|accreditation/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/licensed by|registered with|iata|approved by/i)).not.toBeInTheDocument();
  });
});

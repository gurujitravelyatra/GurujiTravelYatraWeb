import { render, screen } from '@testing-library/react';

import { TourPackagesHero } from '../TourPackagesHero';
import { PackagesCatalogue } from '../PackagesCatalogue';
import { getCategoryChips } from '@/content/get-category-chips';
import { publiclyListedRails } from '@/content/public-listing';

const categories = getCategoryChips(publiclyListedRails);

function renderPage() {
  return render(
    <>
      <TourPackagesHero />
      <PackagesCatalogue rails={publiclyListedRails} categories={categories} />
    </>
  );
}

/**
 * H1 — the COPY FIDELITY RULE, applied to RENDERED COPY rather than to one
 * fixture file.
 *
 * The rule existed (`tabs.fixture.ts`) and was tested (`TripFinderBar.test`),
 * but only against that single fixture — so `/tour-packages` could promise
 * "easy filters and real-time availability" in hardcoded JSX and no test
 * noticed. There is no availability data anywhere in this project: no
 * departure dates, no seat counts (`Package.seatsLabel` is set by zero
 * records), and no live source to read either from.
 *
 * This scans everything the page actually renders, so the next unbacked claim
 * fails here no matter which file it is typed into.
 */
describe('/tour-packages rendered copy claims nothing the product cannot back', () => {
  const bannedClaims: [label: string, pattern: RegExp][] = [
    ['live availability', /availab(le|ility)/i],
    ['real-time anything', /real[\s-]?time/i],
    ['seat counts', /seats? (left|open|available|remaining)/i],
    ['departure dates', /departure date|departing on|next departure/i],
    ['instant booking', /book (now|instantly)|instant (booking|confirmation)/i],
  ];

  for (const [label, pattern] of bannedClaims) {
    it(`never claims ${label}`, () => {
      const { container } = renderPage();
      expect(container.textContent ?? '').not.toMatch(pattern);
    });
  }

  it('keeps the claim it CAN back — the filters are real', () => {
    renderPage();

    expect(screen.getByText(/Find your perfect trip with easy filters\./)).toBeInTheDocument();
    // "Easy filters" is only honest because these exist and work.
    expect(screen.getByLabelText('Destination')).toBeEnabled();
    expect(screen.getByRole('group', { name: 'Filter by travel category' })).toBeInTheDocument();
  });

  it('quotes no price bound that is not in the data', () => {
    const { container } = renderPage();

    // The filter bar's readout is computed from the listed journeys; the old
    // hardcoded band appeared nowhere in them.
    expect(container.textContent ?? '').not.toMatch(/₹15,000 — ₹75,000/);
  });

  it('renders the three previously price-unconfirmed tours like any other card (CRM-migration decision 1)', () => {
    renderPage();

    // The website no longer withholds a tour for an unconfirmed price — the
    // CRM's own isLiveOnWebsite publish gate is trusted fully instead — so
    // these three cards exist here same as before, each with its real price.
    for (const name of ['Do Dham Yatra', 'Kashi Darshan', 'Kashmir Family Escape']) {
      expect(screen.getByRole('link', { name: new RegExp(name) })).toBeInTheDocument();
    }
  });
});

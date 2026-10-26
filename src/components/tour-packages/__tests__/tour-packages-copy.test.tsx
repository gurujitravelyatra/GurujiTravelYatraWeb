import { render, screen } from '@testing-library/react';

import { TourPackagesHero } from '../TourPackagesHero';
import { PackagesCatalogue } from '../PackagesCatalogue';
import type { CrmCategory, CrmTourCard } from '@/server/crm/types';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const categories: CrmCategory[] = ['Spiritual', 'Adventure', 'International'];

function tour(slug: string): CrmTourCard {
  return {
    slug,
    name: `Tour ${slug}`,
    category: 'Adventure',
    shortDescription: 'A trip.',
    coverImageUrl: 'https://res.cloudinary.com/tour-images/abc.jpg',
    price: { amount: 25000, currency: 'INR' },
    durationDays: 6,
    durationNights: 5,
    departureCity: null,
    primaryPlace: { name: 'Place', slug: 'place' },
    nextDeparture: { date: '2026-07-01', seatsLeft: 4 },
    hasBrochure: false,
  };
}

function renderPage(tours: CrmTourCard[] = [tour('a')]) {
  return render(
    <>
      <TourPackagesHero />
      <PackagesCatalogue
        tours={tours}
        total={tours.length}
        page={1}
        pageSize={12}
        categories={categories}
        places={[]}
        months={[]}
        selectedCategory="All"
        selectedPlace="All"
        selectedMonth="All"
      />
    </>
  );
}

/**
 * H1 — the COPY FIDELITY RULE, applied to RENDERED COPY rather than to one
 * fixture file.
 *
 * CRM-migration Step 2 UPDATE: "seat counts" and "departure dates" are
 * REMOVED from the banned list. They were banned because no such data
 * existed anywhere in the project; the CRM now provides real
 * `nextDeparture: {date, seatsLeft}` data, so `PackageCard` rendering
 * "4 seats left" is an honest claim, not a fabricated one. What is STILL
 * banned is marketing language the contract does not support: "real-time"
 * sync claims, and "instant booking" (the CRM has enquiry/reserve-SEAT
 * requests, never an instant confirmed booking flow).
 */
describe('/tour-packages rendered copy claims nothing the product cannot back', () => {
  const bannedClaims: [label: string, pattern: RegExp][] = [
    ['real-time anything', /real[\s-]?time/i],
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
    expect(screen.getByRole('group', { name: 'Filter by travel category' })).toBeInTheDocument();
  });

  it('quotes no hardcoded price bound — the old filter bar\'s readout field is gone entirely', () => {
    const { container } = renderPage();
    expect(container.textContent ?? '').not.toMatch(/₹15,000 — ₹75,000/);
  });

  it('renders a real seat count when the CRM reports one — an honest claim, not a fabricated one', () => {
    renderPage([tour('with-seats')]);
    expect(screen.getByText('4 seats left')).toBeInTheDocument();
  });

  it('never renders a struck-through "was" price or a "Save ₹X" badge anywhere on the page', () => {
    renderPage();
    expect(screen.queryByText(/^Save ₹/)).not.toBeInTheDocument();
  });
});

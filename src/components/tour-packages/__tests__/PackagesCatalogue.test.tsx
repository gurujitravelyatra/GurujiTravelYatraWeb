import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PackagesCatalogue } from '../PackagesCatalogue';
import type { CrmCategory, CrmPlace, CrmTourCard } from '@/server/crm/types';

const push = jest.fn();
let currentSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => currentSearchParams,
}));

function tour(slug: string, category: CrmCategory = 'Adventure'): CrmTourCard {
  return {
    slug,
    name: `Tour ${slug}`,
    category,
    shortDescription: 'A trip.',
    coverImageUrl: 'https://res.cloudinary.com/tour-images/abc.jpg',
    price: { amount: 25000, currency: 'INR' },
    durationDays: 6,
    durationNights: 5,
    departureCity: null,
    primaryPlace: { name: 'Place', slug: 'place' },
    nextDeparture: null,
    hasBrochure: false,
  };
}

const categories: CrmCategory[] = ['Spiritual', 'Adventure', 'International'];
const places: CrmPlace[] = [
  {
    name: 'Goa',
    slug: 'goa',
    region: 'West India',
    description: 'd',
    imageUrl: 'https://res.cloudinary.com/place-images/goa.jpg',
    showInCustomBuilder: true,
    liveTourCount: 1,
  },
];
const months = ['2026-07'];

function renderCatalogue(overrides: Partial<React.ComponentProps<typeof PackagesCatalogue>> = {}) {
  const tours = [tour('a'), tour('b'), tour('c')];
  return render(
    <PackagesCatalogue
      tours={tours}
      total={tours.length}
      page={1}
      pageSize={12}
      categories={categories}
      places={places}
      months={months}
      selectedCategory="All"
      selectedPlace="All"
      selectedMonth="All"
      {...overrides}
    />
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  currentSearchParams = new URLSearchParams();
});

/**
 * CRM-migration Step 2: `/tour-packages` is now ONE server-filtered grid
 * (`GET /public/tours`'s `category`/`place`/`month`/`page`), not four
 * client-filtered rails. Filter controls navigate (via `router.push` with a
 * new query string), which the SERVER re-renders with new results — this
 * component itself holds no filtering logic over a pre-fetched array.
 */
describe('PackagesCatalogue', () => {
  it('renders the tours it is given and the visible/total count', () => {
    renderCatalogue();
    expect(screen.getByText('3 of 3 journeys')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Tour [abc]/ })).toHaveLength(3);
  });

  it('selecting a category pushes a new URL with that category, dropping page', async () => {
    const user = userEvent.setup();
    renderCatalogue();

    await user.click(screen.getByRole('button', { name: 'International' }));

    expect(push).toHaveBeenCalledWith('/tour-packages?category=International');
  });

  it('selecting a place pushes a new URL with that place', async () => {
    const user = userEvent.setup();
    renderCatalogue();

    await user.selectOptions(screen.getByLabelText('Destination'), 'goa');

    expect(push).toHaveBeenCalledWith('/tour-packages?place=goa');
  });

  it('selecting a month pushes a new URL with that month', async () => {
    const user = userEvent.setup();
    renderCatalogue();

    await user.selectOptions(screen.getByLabelText('Travel month'), '2026-07');

    expect(push).toHaveBeenCalledWith('/tour-packages?month=2026-07');
  });

  it('combines filters already present in the URL with a new one', async () => {
    currentSearchParams = new URLSearchParams({ category: 'International' });
    const user = userEvent.setup();
    renderCatalogue({ selectedCategory: 'International' });

    await user.selectOptions(screen.getByLabelText('Destination'), 'goa');

    const [pushedUrl] = push.mock.calls[0] as [string];
    expect(pushedUrl).toContain('category=International');
    expect(pushedUrl).toContain('place=goa');
  });

  it('Clear navigates back to the plain /tour-packages', async () => {
    const user = userEvent.setup();
    renderCatalogue();

    await user.click(screen.getByRole('button', { name: /Clear/ }));
    expect(push).toHaveBeenCalledWith('/tour-packages');
  });

  it('shows the empty state when there are no tours', () => {
    renderCatalogue({ tours: [], total: 0 });
    expect(screen.getByText('No journeys match this filter yet.')).toBeInTheDocument();
  });

  it('renders pagination controls only when there is more than one page', () => {
    renderCatalogue({ total: 3, pageSize: 12 });
    expect(screen.queryByRole('navigation', { name: 'Tour packages pagination' })).not.toBeInTheDocument();

    renderCatalogue({ total: 30, pageSize: 12, page: 1 });
    expect(screen.getByRole('navigation', { name: 'Tour packages pagination' })).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
  });

  it('disables Previous on the first page and Next on the last page', () => {
    renderCatalogue({ total: 30, pageSize: 12, page: 1 });
    expect(screen.getByRole('button', { name: /Previous/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Next/ })).toBeEnabled();
  });

  it('Next pushes the next page number', async () => {
    const user = userEvent.setup();
    renderCatalogue({ total: 30, pageSize: 12, page: 1 });

    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(push).toHaveBeenCalledWith('/tour-packages?page=2');
  });
});

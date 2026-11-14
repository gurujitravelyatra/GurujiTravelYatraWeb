/**
 * @jest-environment node
 */
import { renderToStaticMarkup } from 'react-dom/server.node';

import { FakeCrmServer } from '@/server/crm/test-support/fake-crm-server';
import type { CrmDeparturesTourCard, CrmPlace } from '@/server/crm/types';

import GroupToursPage from '../page';

jest.mock('@/components/layout/SiteShell', () => ({
  SiteShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

jest.mock('@/components/modals/modal-context', () => ({
  useModal: () => ({ modal: null, openEnquiry: jest.fn(), openBrochure: jest.fn(), openGroupReservation: jest.fn(), close: jest.fn() }),
}));

const server = new FakeCrmServer();
const originalApiUrl = process.env.CRM_API_URL;

beforeAll(async () => {
  await server.start();
});

afterAll(async () => {
  await server.stop();
});

beforeEach(() => {
  server.resetState();
  process.env.CRM_API_URL = server.url;
});

afterEach(() => {
  if (originalApiUrl === undefined) delete process.env.CRM_API_URL;
  else process.env.CRM_API_URL = originalApiUrl;
});

function emptySearchParams() {
  return Promise.resolve({});
}

function departure(overrides: Partial<CrmDeparturesTourCard>): CrmDeparturesTourCard {
  return {
    slug: 'tour',
    name: 'A Tour',
    category: 'Group',
    shortDescription: '',
    coverImageUrl: '',
    price: null,
    durationDays: 5,
    durationNights: 4,
    departureCity: null,
    primaryPlace: null,
    nextDeparture: null,
    hasBrochure: false,
    departureDate: '2026-07-10',
    ...overrides,
  };
}

/**
 * User decision (2026-11-14, Trip Finder business rules, item 6): the real
 * "GET /public/departures" endpoint can return any category — this page
 * must filter to Group itself.
 */
describe('/group-tours — category filtering (rule 6)', () => {
  it('shows a Group departure and hides a non-Group one, even though the endpoint returned both', async () => {
    server.setState({
      departures: {
        departures: [
          departure({ slug: 'char-dham', name: 'Char Dham Yatra', category: 'Group' }),
          departure({ slug: 'spiti-trek', name: 'Spiti Trek', category: 'Adventure' }),
        ],
        months: [],
      },
    });

    const html = renderToStaticMarkup(await GroupToursPage({ searchParams: emptySearchParams() }));

    expect(html).toContain('Char Dham Yatra');
    expect(html).not.toContain('Spiti Trek');
  });
});

/**
 * Brief §B (2026-11-14): the Trip Finder's Group tab lands here via
 * `?destination=` when several Group tours match — the SAME matching rule
 * `resolveTripFinder` used to find them.
 */
describe('/group-tours — Trip Finder destination filter', () => {
  it('filters to departures matching the destination, by tour name', async () => {
    server.setState({
      departures: {
        departures: [
          departure({ slug: 'kashmir-group', name: 'Kashmir Group Tour', category: 'Group' }),
          departure({ slug: 'char-dham', name: 'Char Dham Yatra', category: 'Group' }),
        ],
        months: [],
      },
    });

    function searchParams() {
      return Promise.resolve({ destination: 'Kashmir' });
    }

    const html = renderToStaticMarkup(await GroupToursPage({ searchParams: searchParams() }));

    expect(html).toContain('Kashmir Group Tour');
    expect(html).not.toContain('Char Dham Yatra');
  });

  it('matches by place region ("state") too', async () => {
    const place: CrmPlace = {
      name: 'Srinagar',
      slug: 'srinagar',
      region: 'Jammu and Kashmir',
      description: '',
      imageUrl: '',
      showInCustomBuilder: true,
      liveTourCount: 1,
    };
    server.setState({
      places: [place],
      departures: {
        departures: [departure({ slug: 'srinagar-tour', name: 'Dal Lake Escape', category: 'Group', primaryPlace: { name: 'Srinagar', slug: 'srinagar' } })],
        months: [],
      },
    });

    function searchParams() {
      return Promise.resolve({ destination: 'Jammu and Kashmir' });
    }

    const html = renderToStaticMarkup(await GroupToursPage({ searchParams: searchParams() }));

    expect(html).toContain('Dal Lake Escape');
  });

  it('shows the month-mismatch note as a visible banner, without hiding anything', async () => {
    server.setState({
      departures: {
        departures: [departure({ slug: 'char-dham', name: 'Char Dham Yatra', category: 'Group' })],
        months: [],
      },
    });

    function searchParams() {
      return Promise.resolve({ note: 'No departure in July, here are the upcoming dates' });
    }

    const html = renderToStaticMarkup(await GroupToursPage({ searchParams: searchParams() }));

    expect(html).toContain('No departure in July, here are the upcoming dates');
    expect(html).toContain('Char Dham Yatra');
  });

  it('renders no crash and the usual empty state when nothing matches the destination', async () => {
    server.setState({
      departures: { departures: [departure({ slug: 'char-dham', name: 'Char Dham Yatra', category: 'Group' })], months: [] },
    });

    function searchParams() {
      return Promise.resolve({ destination: 'Nowhereland' });
    }

    const html = renderToStaticMarkup(await GroupToursPage({ searchParams: searchParams() }));

    expect(html).not.toContain('Char Dham Yatra');
    expect(html).toContain('No departures match this month yet.');
  });
});

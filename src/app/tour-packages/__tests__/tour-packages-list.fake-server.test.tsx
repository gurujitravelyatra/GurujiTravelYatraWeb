/**
 * @jest-environment node
 */
import { renderToStaticMarkup } from 'react-dom/server.node';

import { FakeCrmServer, defaultFakeCrmState } from '@/server/crm/test-support/fake-crm-server';
import type { CrmTourCard } from '@/server/crm/types';

import TourPackagesPage from '../page';

/**
 * Production incident 2026-10-27, Bug 1: `/tour-packages` showed the
 * client error screen "This page couldn't load" against the real deployed
 * CRM. Same root cause as `/` (`PackageCard`'s unguarded
 * `tour.primaryPlace.name`, since `PackagesCatalogue` renders the exact
 * same card) — reproduced here against this page specifically, plus the
 * other real-shaped sparse conditions reported: empty departures, exactly
 * one category.
 */

jest.mock('@/components/modals/modal-context', () => ({
  useModal: () => ({ modal: null, openEnquiry: jest.fn(), openBrochure: jest.fn(), close: jest.fn() }),
}));

jest.mock('@/components/layout/SiteShell', () => ({
  SiteShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

// `PackagesCatalogue` ('use client') calls useRouter()/useSearchParams() —
// outside a real App Router context (this test calls the page function
// directly, no real Next render tree), those throw, which the page's own
// <Suspense fallback={null}> then swallows into its fallback — a TESTING
// artefact, not a real app behaviour, and why the catalogue silently
// disappeared on first write of this test.
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
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

const REAL_SPARSE_TOUR: CrmTourCard = {
  slug: 'real-tour',
  name: 'A Real Tour',
  category: 'Adventure',
  shortDescription: 'A description.',
  coverImageUrl: 'https://media.gurujitravelyatra.com/tour-images/abc.jpg',
  price: { amount: 10000, currency: 'INR' },
  durationDays: 6,
  durationNights: 5,
  departureCity: null,
  primaryPlace: null,
  nextDeparture: null,
  hasBrochure: true,
};

describe('/tour-packages against the real-shaped (sparse) fake CRM payloads', () => {
  it('renders successfully with a tour whose primaryPlace is null, instead of the client error screen', async () => {
    server.setState({
      tours: [REAL_SPARSE_TOUR],
      categories: [{ category: 'Adventure', count: 1 }],
      departures: { departures: [], months: [] },
      places: [],
    });

    const element = await TourPackagesPage({ searchParams: emptySearchParams() });
    const html = renderToStaticMarkup(element);

    expect(html).toContain('A Real Tour');
  });

  it('renders successfully with exactly one category and zero departures/places', async () => {
    server.setState({
      tours: [REAL_SPARSE_TOUR],
      categories: [{ category: 'Adventure', count: 1 }],
      departures: { departures: [], months: [] },
      places: [],
    });

    const element = await TourPackagesPage({ searchParams: emptySearchParams() });
    const html = renderToStaticMarkup(element);

    expect(html).toContain('Adventure');
  });

  it('renders successfully with absolutely everything empty (the fully-sparse case)', async () => {
    server.setState({
      tours: [],
      categories: [],
      departures: { departures: [], months: [] },
      places: [],
      site: defaultFakeCrmState().site,
    });

    const element = await TourPackagesPage({ searchParams: emptySearchParams() });
    const html = renderToStaticMarkup(element);

    expect(html).toContain('No journeys match this filter yet.');
  });
});

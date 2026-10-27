/**
 * @jest-environment node
 */
import { renderToStaticMarkup } from 'react-dom/server.node';

import { FakeCrmServer, defaultFakeCrmState } from '@/server/crm/test-support/fake-crm-server';
import type { CrmPlace, CrmTourCard } from '@/server/crm/types';

import HomePage from '../page';

/**
 * Production incident 2026-10-27, Bug 1: `/` returned a real HTTP 500
 * against the real deployed CRM. Root cause, confirmed: `GET /public/tours`
 * returned a tour with `"primaryPlace": null` — a real, healthy CRM state
 * the contract document's own examples never show — and `PackageCard`
 * (rendered on this page's Popular Destinations grid) read
 * `tour.primaryPlace.name` unconditionally. This reproduces the exact real
 * payload against the fake server and proves the page survives it.
 */

jest.mock('@/components/modals/modal-context', () => ({
  useModal: () => ({ modal: null, openEnquiry: jest.fn(), openBrochure: jest.fn(), close: jest.fn() }),
}));

jest.mock('@/components/layout/SiteShell', () => ({
  SiteShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
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

/** The EXACT real production tour payload reported in the incident — `primaryPlace: null`, included. */
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

describe('/ against the real-shaped (sparse) fake CRM payloads', () => {
  it('renders successfully with a tour whose primaryPlace is null, instead of 500ing', async () => {
    server.setState({
      tours: [REAL_SPARSE_TOUR],
      site: { ...defaultFakeCrmState().site, settings: { ...defaultFakeCrmState().site.settings, heroHeadline: 'test' } },
    });

    const element = await HomePage();
    const html = renderToStaticMarkup(element);

    expect(html).toContain('A Real Tour');
    expect(html).toContain('test');
  });

  it('renders successfully with absolutely everything empty/null (the fully-sparse case)', async () => {
    server.setState({
      tours: [],
      places: [],
      site: defaultFakeCrmState().site,
    });

    const element = await HomePage();
    const html = renderToStaticMarkup(element);

    // No crash is the primary assertion; the stats band specifically must
    // not render at all when every figure label is null (bug report's own
    // explicit example of "hide the section, don't show a blank one").
    expect(html).not.toContain('section-11-stats');
  });

  it('a place with zero live tours does not crash the Explore Destinations rail', async () => {
    const sparsePlace: CrmPlace = {
      name: 'Kedarnath',
      slug: 'kedarnath',
      region: 'Uttarakhand',
      description: '',
      imageUrl: 'https://media.gurujitravelyatra.com/place-images/kedarnath.webp',
      showInCustomBuilder: true,
      liveTourCount: 0,
    };
    server.setState({ places: [sparsePlace] });

    const element = await HomePage();
    const html = renderToStaticMarkup(element);

    // The Home "Explore Destinations" rail DOES filter to liveTourCount > 0
    // (a real, legitimate design choice — "only show destinations you can
    // actually book right now"), unlike the customize-tours builder grid,
    // which must not filter by it at all. A zero-live-tour place is
    // correctly absent HERE without that absence being a crash.
    expect(html).not.toContain('Kedarnath');
  });
});

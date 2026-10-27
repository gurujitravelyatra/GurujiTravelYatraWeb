/**
 * @jest-environment node
 */
import { renderToStaticMarkup } from 'react-dom/server.node';

import { FakeCrmServer, defaultFakeCrmState } from '@/server/crm/test-support/fake-crm-server';
import type { CrmPlace, CrmSiteResponse, CrmTourDetail } from '@/server/crm/types';

import PackageDetailPage from '../[slug]/page';

/**
 * CRM-migration Step 6 — the capstone integration test: a REAL page
 * (`PackageDetailPage`) rendered against a REAL fake CRM server, over a
 * REAL HTTP connection — `getTourBySlug()` is never mocked here, which is
 * the whole point: every other test file in this migration checked the
 * client, the route, or the component in isolated pieces; this is what
 * proves the tour-detail path works end to end as one real page.
 *
 * Two things ARE mocked, and neither is a CRM concern:
 *  - `useModal` — a client-only concern (`PackageDetailCtas`'s "Enquire
 *    Now"/"Download Brochure" buttons), same stub every other page-render
 *    test in this repo uses.
 *  - `SiteShell` — it is itself an ASYNC Server Component (it fetches
 *    `GET /public/site`/`/public/places` for the chrome), and
 *    `renderToStaticMarkup` cannot await a nested async component — it
 *    suspends — the exact limitation `legal-pages.test.tsx`/
 *    `stored-xss-render.test.tsx` already worked around in Step 2. Its
 *    OWN CRM wiring is covered by `SiteShell`'s/`Footer`'s/`Navbar`'s own
 *    tests; this file is about the DETAIL PAGE's tour data.
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

const tourDetail: CrmTourDetail = {
  slug: 'spiti-valley-circuit',
  name: 'Spiti Valley Circuit',
  category: 'Adventure',
  shortDescription: 'A high-altitude loop through the Spiti valley.',
  coverImageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/spiti.jpg',
  price: { amount: 42500, currency: 'INR' },
  durationDays: 6,
  durationNights: 5,
  departureCity: null,
  primaryPlace: { name: 'Spiti Valley', slug: 'spiti-valley' },
  nextDeparture: { date: '2026-09-15', seatsLeft: 4 },
  hasBrochure: true,
  description: 'The full description of a real high-altitude journey.',
  highlights: ['Chandratal Lake', 'Key Monastery'],
  itinerary: [{ day: 1, title: 'Arrival in Shimla', detail: 'Meet the group and head out.' }],
  inclusions: ['All meals', 'Permits'],
  exclusions: ['Flights to Delhi'],
  cancellationPolicy: 'Full refund up to 30 days before departure.',
  gallery: [{ url: 'https://res.cloudinary.com/demo/image/upload/v1/g1.jpg', alt: 'Valley view at dawn' }],
  brochureUrl: 'https://res.cloudinary.com/demo/raw/upload/v1/brochure.pdf',
  places: [{ name: 'Spiti Valley', slug: 'spiti-valley' }],
  pricingOptions: [],
  departures: [],
  seoTitle: 'Spiti Valley Circuit — Guruji Travel Yatra',
  seoDescription: 'A high-altitude loop through the Spiti valley.',
};

const places: CrmPlace[] = [
  {
    name: 'Spiti Valley',
    slug: 'spiti-valley',
    region: 'Himachal Pradesh',
    description: 'A high-altitude desert valley.',
    imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/spiti-place.jpg',
    showInCustomBuilder: true,
    liveTourCount: 1,
  },
];

const site: CrmSiteResponse = {
  ...defaultFakeCrmState().site,
  settings: { ...defaultFakeCrmState().site.settings, phone: '+91 90999 57658', email: 'info@gurujitravelyatra.com' },
};

describe('the tour detail page against a real fake CRM server, end to end', () => {
  it('renders the real tour name, price and itinerary it got back from a real HTTP round trip', async () => {
    server.setState({ tourDetails: { 'spiti-valley-circuit': tourDetail }, places, site });

    const element = await PackageDetailPage({ params: Promise.resolve({ slug: 'spiti-valley-circuit' }) });
    const html = renderToStaticMarkup(element);

    expect(html).toContain('Spiti Valley Circuit');
    expect(html).toContain('₹42,500');
    expect(html).toContain('Chandratal Lake');
    expect(html).toContain('Arrival in Shimla');
    expect(html).toContain('Full refund up to 30 days before departure.');
  });

  it('renders "Download Brochure" when the real CRM response says hasBrochure, and omits it when not', async () => {
    server.setState({
      tourDetails: {
        'spiti-valley-circuit': tourDetail,
        'no-brochure-tour': { ...tourDetail, slug: 'no-brochure-tour', hasBrochure: false, brochureUrl: null },
      },
      places,
      site,
    });

    const withBrochure = renderToStaticMarkup(
      await PackageDetailPage({ params: Promise.resolve({ slug: 'spiti-valley-circuit' }) })
    );
    expect(withBrochure).toContain('Download Brochure');

    const withoutBrochure = renderToStaticMarkup(
      await PackageDetailPage({ params: Promise.resolve({ slug: 'no-brochure-tour' }) })
    );
    expect(withoutBrochure).not.toContain('Download Brochure');
  });

  it('a slug the fake CRM genuinely does not have calls notFound() rather than rendering garbage', async () => {
    server.setState({ places, site });

    // `notFound()` throws `new Error('NEXT_HTTP_ERROR_FALLBACK;404')` with a
    // matching `.digest` (node_modules/next/dist/client/components/
    // not-found.js) — this is Next's own real control-flow signal, not a
    // generic crash, confirming `getTourBySlug()`'s real
    // `{status:'not-found'}` outcome reached the page's own `notFound()`
    // call rather than being silently swallowed.
    await expect(
      PackageDetailPage({ params: Promise.resolve({ slug: 'genuinely-does-not-exist' }) })
    ).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
  });
});

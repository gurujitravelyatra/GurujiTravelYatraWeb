/**
 * @jest-environment node
 */
import { renderToStaticMarkup } from 'react-dom/server.node';

/**
 * THE DEPARTURE VISIBILITY GATE, at the two PUBLIC SURFACES (2026-09-25).
 *
 * `prisma-content-adapter.test.ts` proves the adapter's predicate. This file
 * proves the thing a visitor and an API consumer actually receive: the real
 * `GET /api/group-tours` handler and the real `/group-tours` page, rendered to
 * the bytes the server sends, over a database whose rows include departures of
 * an ARCHIVED tour and of a DRAFT tour.
 *
 * ## What is mocked, and why that does not hollow the test out
 *
 * Only the TRANSPORT. The composition root is pinned to a genuine
 * `PrismaContentAdapter` wrapping a fake Prisma client — so the route and the
 * page call the real adapter, which runs the real `toPublicDeparture` gate. The
 * fake client IGNORES the where clause and returns every row, withheld ones
 * included, so the only thing standing between those rows and the output is the
 * predicate. That is the point: a test whose mock filtered by status would pass
 * with the gate deleted.
 *
 * ## Proven able to fail
 *
 * With `getGroupDepartures`' `toPublicDeparture` call replaced by a
 * pass-through, all 7 tests went red (measured 2026-09-25): the absence checks
 * because the hidden tours' batches appeared, the count/floor checks because
 * "5 departures found" replaced "3", and the marker checks because the parent's
 * price doubt was no longer carried across. The literal floors
 * (`toHaveLength(3)`, the named present departures, "3 departures found") are
 * what stop an empty or errored page from satisfying the absence checks.
 */

jest.mock('@/components/modals/modal-context', () => ({
  useModal: () => ({
    modal: null,
    openEnquiry: jest.fn(),
    openBrochure: jest.fn(),
    openCustomTrip: jest.fn(),
    openGroupReservation: jest.fn(),
    close: jest.fn(),
  }),
}));

const PUBLISHED = { status: 'PUBLISHED', archivedAt: null, pricingUnverified: false };

function row(slug: string, name: string, tourSlug: string | null, tour: Record<string, unknown> | null, extra = {}) {
  return {
    slug,
    name,
    tourSlug,
    tour,
    category: 'Adventure',
    photoKey: 'Spiti Valley',
    dateRangeLabel: '06 — 15 Oct 2026',
    month: 'Oct',
    durationLabel: '9N / 10D',
    boardingPoints: 'Delhi',
    tourManagerLabel: 'Yes, GTY manager',
    priceFrom: '₹42,500',
    seatsLabel: '08 seats left',
    scriptAccent: 'Where\nThe Road\nEnds',
    durationUnverified: false,
    priceUnverified: false,
    sortOrder: 0,
    destination: { name: 'Spiti Valley' },
    ...extra,
  };
}

/** Names chosen to be unique substrings of the rendered page. */
const ARCHIVED_NAME = 'Zanskar Batch Of An Archived Tour';
const DRAFT_NAME = 'Zanskar Batch Of A Draft Tour';
const LIVE_NAME = 'Zanskar Batch Of A Live Tour';
const UNLINKED_NAME = 'Zanskar Batch Linked To No Tour';
const DOUBTFUL_NAME = 'Zanskar Batch Of A Price Unconfirmed Tour';

const ROWS = [
  row('archived-batch', ARCHIVED_NAME, 'archived-tour', { ...PUBLISHED, archivedAt: new Date('2026-09-20T00:00:00Z') }, {
    // A month nothing else uses: if the gate leaked, a "Dec 2026" chip would appear too.
    dateRangeLabel: '01 — 09 Dec 2026',
    month: 'Dec',
  }),
  row('draft-batch', DRAFT_NAME, 'draft-tour', { ...PUBLISHED, status: 'DRAFT' }),
  row('live-batch', LIVE_NAME, 'live-tour', PUBLISHED),
  row('unlinked-batch', UNLINKED_NAME, null, null),
  row('doubtful-batch', DOUBTFUL_NAME, 'doubtful-tour', { ...PUBLISHED, pricingUnverified: true }, { priceFrom: '₹28,900' }),
];

jest.mock('@/content/content-adapter', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaContentAdapter } = require('@/content/adapters/prisma-content-adapter');
  // A client that ignores `where` entirely — see the file header.
  const client = { groupDeparture: { findMany: async () => ROWS } };
  return { contentAdapter: new PrismaContentAdapter(client), brochureAdapter: null };
});

import { GET as getGroupTours } from '@/app/api/group-tours/route';
import GroupToursPage from '../page';

describe('GET /api/group-tours — a departure of a hidden tour is not published', () => {
  async function fetchSlugs() {
    const response = await getGroupTours();
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { slug: string; name: string; priceUnverified: boolean }[] };
    return body.data;
  }

  it('omits the departure of an ARCHIVED tour and of a DRAFT tour', async () => {
    const data = await fetchSlugs();
    const slugs = data.map((departure) => departure.slug);

    expect(slugs).not.toContain('archived-batch');
    expect(slugs).not.toContain('draft-batch');
  });

  it('still returns the live, unlinked and price-unconfirmed departures — nothing is over-withheld', async () => {
    const data = await fetchSlugs();
    expect(data.map((departure) => departure.slug)).toEqual(['live-batch', 'unlinked-batch', 'doubtful-batch']);
    expect(data).toHaveLength(3);
  });

  it('marks the price-unconfirmed tour’s departure in the payload rather than hiding it', async () => {
    const data = await fetchSlugs();
    const doubtful = data.find((departure) => departure.slug === 'doubtful-batch');
    expect(doubtful?.priceUnverified).toBe(true);
    expect(data.find((departure) => departure.slug === 'live-batch')?.priceUnverified).toBe(false);
  });
});

describe('/group-tours — a departure of a hidden tour is not rendered', () => {
  async function renderPage(): Promise<string> {
    return renderToStaticMarkup(await GroupToursPage());
  }

  it('renders the live, unlinked and price-unconfirmed departures (the floor that makes the absences mean something)', async () => {
    const html = await renderPage();
    expect(html).toContain(LIVE_NAME);
    expect(html).toContain(UNLINKED_NAME);
    expect(html).toContain(DOUBTFUL_NAME);
    expect(html).toContain('3 departures found');
  });

  it('does not render the departure of an ARCHIVED tour or of a DRAFT tour', async () => {
    const html = await renderPage();
    expect(html).not.toContain(ARCHIVED_NAME);
    expect(html).not.toContain(DRAFT_NAME);
  });

  it('offers no month chip that only a withheld departure would have filled', async () => {
    const html = await renderPage();
    expect(html).toContain('Oct 2026');
    expect(html).not.toContain('Dec 2026');
  });

  it('carries the unconfirmed-price footnote for the marked departure', async () => {
    const html = await renderPage();
    expect(html).toContain('data-testid="group-price-note"');
  });
});

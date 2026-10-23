import { renderToStaticMarkup } from 'react-dom/server.node';

import { publicWithholdReason } from '@/content/public-listing';
import type { AdminTourListItem, AdminTourDetail } from '@/server/admin/tours/tour-repository';

/**
 * H1, historical — THE ADMIN MUST NOT CLAIM A TOUR IS LIVE WHEN THE PUBLIC
 * GATE WITHHOLDS IT.
 *
 * `Tour.pricingUnverified` used to withhold a tour from every public surface:
 * no card, no rail, no catalogue row, and `/tour-packages/[slug]` returned
 * 404. The admin CMS was the one surface that did not know — it showed a
 * green "Published" pill, offered a "View on site ↗" link to a page that
 * 404'd, and printed "Saved and published. This tour is now visible on the
 * public site." for a tour that was not. That was fixed by composing every
 * admin claim out of `publicWithholdReason()`, the same predicate the public
 * site itself runs.
 *
 * ## CRM-migration decision 1 removed the condition this test file guarded
 *
 * The website no longer withholds ANY tour for an unconfirmed price — the
 * CRM's own `isLiveOnWebsite` publish gate (today's stand-in:
 * `status`/`archivedAt`) is trusted fully instead. `publicWithholdReason()`
 * can no longer return `'PRICE_UNCONFIRMED'`, so there is no longer a case
 * where a PUBLISHED, unarchived tour disagrees with the admin's pill. The
 * admin's "withheld — price unconfirmed" banner, the "Publish in CMS only"
 * button label and the `withheldFromPublicSite` prop were all removed as
 * dead code that could never trigger again (`src/app/admin/tours/page.tsx`,
 * `src/app/admin/tours/[id]/edit/page.tsx`, `src/components/admin/TourForm.tsx`).
 *
 * This file now asserts the INVERSE of what it used to for a
 * `pricingUnverified` tour (it is an ordinary admin row in every respect),
 * and keeps the still-genuine cross-check for DRAFT/ARCHIVED, which decision
 * 1 did not touch.
 *
 * ## These tests render the real page components
 *
 * Not a helper, not the predicate in isolation — the predicate has its own
 * tests and passing them is what the old code did too. The assertion that
 * means something is that the STRING a human reads is correct, so the pages
 * are rendered with `renderToStaticMarkup` (the server renderer Next uses)
 * and the markup is searched. `react-dom/server.node` explicitly: under
 * jsdom the bare `react-dom/server` specifier resolves to the browser build
 * and throws on import — the same trap `stored-xss-render.test.tsx` records.
 */

const mockRequireAdminSession = jest.fn();
const mockListAdminTours = jest.fn();
const mockGetAdminTourBySlug = jest.fn();
const mockListDestinationOptions = jest.fn();
const mockIsCloudinaryConfigured = jest.fn();

jest.mock('@/server/auth/session', () => ({
  requireAdminSession: () => mockRequireAdminSession(),
  getAdminSession: () => mockRequireAdminSession(),
}));

jest.mock('@/server/admin/tours/tour-repository', () => ({
  listAdminTours: (filter: unknown) => mockListAdminTours(filter),
  getAdminTourBySlug: (slug: string) => mockGetAdminTourBySlug(slug),
  listDestinationOptions: () => mockListDestinationOptions(),
}));

jest.mock('@/server/uploads/cloudinary', () => ({
  isCloudinaryConfigured: () => mockIsCloudinaryConfigured(),
  CLOUDINARY_NOT_CONFIGURED: 'not configured',
}));

/**
 * The editor is a large client component with `useActionState`, file inputs and
 * `XMLHttpRequest` progress — none of which is what this file is about, and all
 * of which would make the edit page untestable server-side. It is replaced by a
 * stub that renders a fixed marker, so the page under test still gets a real
 * component tree.
 */
/**
 * The list page imports its server actions, and `actions.ts` imports
 * `next/cache` — which pulls Next's streaming helpers and dies on a missing
 * `TextEncoder` under jsdom. The actions themselves are covered by
 * `admin-mutation-guards.test.ts` and are not what this file is about; stubbing
 * the module keeps the render under test without dragging in the server runtime.
 */
jest.mock('../tours/actions', () => ({
  setTourPublishedAction: jest.fn(),
  setTourArchivedAction: jest.fn(),
  saveTourAction: jest.fn(),
}));

jest.mock('@/components/admin/TourForm', () => ({
  TourForm: () => <div data-testid="tour-form" />,
}));

import AdminToursPage from '../tours/page';
import EditTourPage from '../tours/[id]/edit/page';

const BASE_ROW: AdminTourListItem = {
  slug: 'do-dham-yatra',
  name: 'Do Dham Yatra',
  category: 'Spiritual',
  destinationName: 'Kedarnath',
  photoKey: 'Kedarnath',
  coverImageUrl: null,
  lifecycle: 'PUBLISHED',
  priceFrom: '₹28,900',
  pricingTierCount: 0,
  departureCount: 0,
  pricingUnverified: true,
  status: 'PUBLISHED',
  archivedAt: null,
  updatedAt: new Date('2026-09-19T00:00:00.000Z'),
};

const BASE_FORM = {
  name: 'Do Dham Yatra',
  slug: 'do-dham-yatra',
  destinationSlug: 'kedarnath',
  category: 'Spiritual' as const,
  audienceTags: [],
  durationLabel: '6 Days 5 Nights',
  subtitle: 'Kedarnath & Badrinath',
  shortDescription: 'A short description.',
  priceFrom: '₹28,900',
  isHot: false,
  inclusions: [],
  exclusions: [],
  itineraryDays: [],
  faqs: [],
  pricingTiers: [],
  galleryImages: [],
  departures: [],
};

function detail(overrides: Partial<AdminTourDetail> = {}): AdminTourDetail {
  return {
    form: BASE_FORM as AdminTourDetail['form'],
    lifecycle: 'PUBLISHED',
    status: 'PUBLISHED',
    archivedAt: null,
    pricingUnverified: true,
    updatedAt: new Date('2026-09-19T00:00:00.000Z'),
    departureMarkers: {},
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireAdminSession.mockResolvedValue({ id: 'u1', email: 'admin@gty.test' });
  mockListDestinationOptions.mockResolvedValue({
    configured: true,
    value: [{ slug: 'kedarnath', name: 'Kedarnath' }],
  });
  mockIsCloudinaryConfigured.mockReturnValue(false);
});

async function renderToursPage(rows: AdminTourListItem[]): Promise<string> {
  mockListAdminTours.mockResolvedValue({ configured: true, value: rows });
  const element = await AdminToursPage({ searchParams: Promise.resolve({}) });
  return renderToStaticMarkup(element);
}

async function renderEditPage(
  value: AdminTourDetail,
  query: Record<string, string> = {}
): Promise<string> {
  mockGetAdminTourBySlug.mockResolvedValue({ configured: true, value });
  const element = await EditTourPage({
    params: Promise.resolve({ id: value.form.slug }),
    searchParams: Promise.resolve(query),
  });
  return renderToStaticMarkup(element);
}

describe('the tour LIST treats a pricingUnverified tour exactly like any other published tour', () => {
  it('renders the Published pill and nothing else about the (removed) price-withholding reason', async () => {
    const html = await renderToursPage([BASE_ROW]);

    expect(html).toContain('Published');
    // The banner this used to assert is gone: there is no condition left
    // under which `publicWithholdReason()` can disagree with this pill.
    expect(html).not.toContain('Withheld from the public site');
    expect(html).not.toContain('price unconfirmed');
  });

  it('offers a plain "Publish" button for a draft, even a price-unconfirmed one', async () => {
    // Pressing Publish on any draft now does exactly what it says: the CRM's
    // own publish gate (today's stand-in: status/archivedAt) is the only
    // thing left that decides visibility.
    const html = await renderToursPage([
      { ...BASE_ROW, lifecycle: 'DRAFT', status: 'DRAFT', pricingUnverified: true },
    ]);

    expect(html).toContain('>Publish<');
    expect(html).not.toContain('Publish in CMS only');
  });
});

describe('the tour EDITOR treats a pricingUnverified tour exactly like any other published tour', () => {
  it('renders no withheld banner', async () => {
    const html = await renderEditPage(detail());

    expect(html).not.toContain('Withheld from the public site');
    expect(html).not.toContain('cannot be cleared from this screen');
  });

  it('offers "View on site", because the page no longer 404s for this tour', async () => {
    const html = await renderEditPage(detail());

    expect(html).toContain('View on site');
    expect(html).toContain('/tour-packages/do-dham-yatra');
  });

  it('says the tour is "now visible on the public site" after a publish — truthfully, since it now is', async () => {
    const html = await renderEditPage(detail(), { saved: 'publish' });

    expect(html).toContain('now visible on the public site');
    expect(html).not.toContain('still NOT visible on the public site');
  });
});

/**
 * THE INVARIANT, NARROWED TO WHAT CAN STILL VARY.
 *
 * `publicWithholdReason()` keeps exactly two reasons now (`DRAFT`,
 * `ARCHIVED`); this checks the admin's view of "what is live" and the public
 * site's view cannot silently disagree about either one. Stated as a
 * cross-check rather than as "the badge renders", because the failure this
 * guards against is a NEW withholding condition being added to
 * `publicWithholdReason()` later and the admin not learning about it.
 */
describe('the admin list and the public catalogue cannot disagree about what is live', () => {
  const CASES: { label: string; row: AdminTourListItem; inPublicCatalogue: boolean }[] = [
    { label: 'an ordinary published tour', row: { ...BASE_ROW, pricingUnverified: false }, inPublicCatalogue: true },
    {
      label: 'a published tour with pricingUnverified set (no longer withheld)',
      row: BASE_ROW,
      inPublicCatalogue: true,
    },
    {
      label: 'a draft',
      row: { ...BASE_ROW, lifecycle: 'DRAFT', status: 'DRAFT', pricingUnverified: false },
      inPublicCatalogue: false,
    },
    {
      label: 'an archived tour',
      row: {
        ...BASE_ROW,
        lifecycle: 'ARCHIVED',
        archivedAt: new Date('2026-01-01T00:00:00.000Z'),
        pricingUnverified: false,
      },
      inPublicCatalogue: false,
    },
  ];

  // Guard the guard, with a literal: a table that lost its rows would make
  // every `it.each` below disappear and the suite would still report green.
  it('covers every lifecycle combination', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(4);
  });

  it.each(CASES.map((c) => [c.label, c] as const))(
    '%s: is either in the public catalogue or marked withheld with a reason',
    (_label, testCase) => {
      /**
       * `publicWithholdReason` is the PUBLIC gate — the same function
       * `isPubliclyListable()` is defined in terms of, and therefore the same
       * one `getAllTours()`/`PrismaContentAdapter` end every query in. Calling
       * it on the ADMIN row is the whole point: if the admin row cannot answer
       * this question, the admin UI cannot either.
       */
      const reason = publicWithholdReason(testCase.row);

      expect(reason === null).toBe(testCase.inPublicCatalogue);

      // And a withheld tour always has a reason the UI can print — never a bare
      // `false` that leaves the admin with nothing to read.
      if (!testCase.inPublicCatalogue) {
        expect(typeof reason).toBe('string');
        expect(reason).not.toBe('');
      }
    }
  );

  it('renders a visible explanation for EVERY withheld case', async () => {
    for (const testCase of CASES.filter((c) => !c.inPublicCatalogue)) {
      const html = await renderToursPage([testCase.row]);
      const reason = publicWithholdReason(testCase.row);

      const explained =
        (reason === 'DRAFT' && html.includes('Draft')) || (reason === 'ARCHIVED' && html.includes('Archived'));

      expect({ reason, explained }).toEqual({ reason, explained: true });
    }
  });
});

/**
 * L2 of the 2026-09-19 review — lives here because this file already renders
 * the real list page. The publish/archive actions redirect to
 * `?notice=tour-missing` when the tour vanished; the list must SAY so, or the
 * click still has no visible result.
 */
describe('the tour list explains a toggle on a tour that no longer exists', () => {
  it('renders the notice when the actions flag it', async () => {
    mockListAdminTours.mockResolvedValue({ configured: true, value: [BASE_ROW] });
    const element = await AdminToursPage({ searchParams: Promise.resolve({ notice: 'tour-missing' }) });
    const html = renderToStaticMarkup(element);

    expect(html).toContain('That tour no longer exists');
    expect(html).toMatch(/role="alert"/);
  });

  it('renders no notice on an ordinary visit', async () => {
    const html = await renderToursPage([BASE_ROW]);
    expect(html).not.toContain('That tour no longer exists');
  });
});

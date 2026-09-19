import { renderToStaticMarkup } from 'react-dom/server.node';

import { publicWithholdReason } from '@/content/public-listing';
import type { AdminTourListItem, AdminTourDetail } from '@/server/admin/tours/tour-repository';

/**
 * H1 — THE ADMIN MUST NOT CLAIM A TOUR IS LIVE WHEN THE PUBLIC GATE WITHHOLDS IT.
 *
 * `Tour.pricingUnverified` withholds a tour from every public surface: no card,
 * no rail, no catalogue row, and `/tour-packages/[slug]` returns 404. The admin
 * CMS was the one surface that did not know. It showed a green "Published" pill,
 * offered a "View on site ↗" link to a page that 404s, and printed "Saved and
 * published. This tour is now visible on the public site." — three claims, all
 * false, for the same three tours.
 *
 * That is the eighth instance of the pattern in
 * `memory/feedback_qg_unenforced-safety-flag.md`, and this time with a twist
 * worth naming: the flag WAS enforced. `isPubliclyListable()` reads it and
 * withholds correctly. What was un-enforced was the flag's VISIBILITY to the
 * person whose job is to notice — so the tell-tale in that memory ("grep the
 * flag name; if the only hits are the definition, the data and a test") gave a
 * false all-clear, because the definition and a real consumer both existed.
 *
 * ## These tests render the real page components
 *
 * Not a helper, not the predicate in isolation — the predicate has its own
 * tests and passing them is what the old code did too. The assertion that means
 * something is that the STRING a human reads changes, so the pages are rendered
 * with `renderToStaticMarkup` (the server renderer Next uses) and the markup is
 * searched. `react-dom/server.node` explicitly: under jsdom the bare
 * `react-dom/server` specifier resolves to the browser build and throws on
 * import — the same trap `stored-xss-render.test.tsx` records.
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
 * stub that ECHOES the one prop under test, so the assertion is still on a value
 * the real component receives rather than on a mock's existence.
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
  TourForm: (props: { withheldFromPublicSite?: boolean }) => (
    <div data-testid="tour-form" data-withheld={String(props.withheldFromPublicSite ?? false)} />
  ),
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
};

function detail(overrides: Partial<AdminTourDetail> = {}): AdminTourDetail {
  return {
    form: BASE_FORM as AdminTourDetail['form'],
    lifecycle: 'PUBLISHED',
    status: 'PUBLISHED',
    archivedAt: null,
    pricingUnverified: true,
    updatedAt: new Date('2026-09-19T00:00:00.000Z'),
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

describe('the tour LIST names a withheld tour as withheld', () => {
  it('renders the reason next to the Published pill', async () => {
    const html = await renderToursPage([BASE_ROW]);

    // The pill is still there — the tour genuinely IS published in the CMS, and
    // hiding that would be a different lie.
    expect(html).toContain('Published');
    expect(html).toContain('Withheld from the public site');
    expect(html).toContain('price unconfirmed');
  });

  it('does NOT put that reason on an ordinary published tour', async () => {
    // The complement, and the half that stops this passing vacuously: a test
    // asserting only the presence of a string would pass just as well if the
    // banner rendered on every row, which would train the admin to ignore it.
    const html = await renderToursPage([{ ...BASE_ROW, pricingUnverified: false }]);

    expect(html).toContain('Published');
    expect(html).not.toContain('Withheld from the public site');
  });

  it('does not offer a plain “Publish” button for a withheld draft', async () => {
    // Pressing Publish on a withheld tour moves `status` and changes nothing a
    // visitor can see. The button must not promise otherwise.
    const html = await renderToursPage([
      { ...BASE_ROW, lifecycle: 'DRAFT', status: 'DRAFT', pricingUnverified: true },
    ]);

    expect(html).toContain('Publish in CMS only');
  });
});

describe('the tour EDITOR explains a withheld tour and links nowhere broken', () => {
  it('renders the banner', async () => {
    const html = await renderEditPage(detail());

    expect(html).toContain('Withheld from the public site');
    expect(html).toContain('price unconfirmed');
  });

  it('says the flag cannot be cleared from this screen', async () => {
    // The user's explicit decision (2026-09-19): badge and banner only, no
    // clear/confirm action. The banner has to say so, or the admin's next move
    // is to hunt for a control that does not exist.
    const html = await renderEditPage(detail());

    expect(html).toContain('cannot be cleared from this screen');
    expect(html).toContain('pricingUnverified');
  });

  it('withholds the “View on site” link, because that page 404s', async () => {
    const html = await renderEditPage(detail());

    expect(html).not.toContain('View on site');
    expect(html).not.toContain('href="/tour-packages/do-dham-yatra"');
  });

  it('still offers “View on site” for a tour that really is live', async () => {
    // Guards the guard: an assertion that the link is ABSENT passes just as
    // well if the link were removed altogether.
    const html = await renderEditPage(detail({ pricingUnverified: false }));

    expect(html).toContain('View on site');
    expect(html).toContain('/tour-packages/do-dham-yatra');
  });

  it('does not say a withheld tour is “now visible on the public site” after saving', async () => {
    const html = await renderEditPage(detail(), { saved: 'publish' });

    expect(html).not.toContain('now visible on the public site');
    expect(html).toContain('still NOT visible on the public site');
  });

  it('DOES say so for a tour that really is live', async () => {
    const html = await renderEditPage(detail({ pricingUnverified: false }), { saved: 'publish' });

    expect(html).toContain('now visible on the public site');
  });

  it('tells the form that this tour is withheld', async () => {
    // The Publish button's label and the sentence beneath it are the form's
    // half of the same claim.
    expect(await renderEditPage(detail())).toContain('data-withheld="true"');
    expect(await renderEditPage(detail({ pricingUnverified: false }))).toContain(
      'data-withheld="false"'
    );
  });
});

/**
 * THE INVARIANT.
 *
 * The two tests above check the copy on two screens. This one checks the
 * property the copy is a rendering of, over arbitrary data: the admin's view of
 * "what is live" and the public site's view of "what is live" cannot silently
 * disagree. Either the public catalogue contains the slug, or the admin row is
 * marked withheld WITH a reason — never neither.
 *
 * Stated as a cross-check rather than as "the badge renders", because the
 * failure this guards against is a FOURTH condition being added to
 * `publicWithholdReason()` later and the admin not learning about it. A reason
 * string the admin does not render is a test failure here, not a silent
 * regression.
 */
describe('the admin list and the public catalogue cannot disagree about what is live', () => {
  const CASES: { label: string; row: AdminTourListItem; inPublicCatalogue: boolean }[] = [
    { label: 'an ordinary published tour', row: { ...BASE_ROW, pricingUnverified: false }, inPublicCatalogue: true },
    { label: 'a price-unconfirmed tour', row: BASE_ROW, inPublicCatalogue: false },
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

  it('renders a visible explanation for EVERY withheld case, not only the flagged one', async () => {
    /**
     * The generalisation of the two copy tests above, and the thing that fails
     * when a fourth withholding condition is added without admin copy: every
     * row the public gate withholds must render SOMETHING beyond the bare
     * lifecycle pill or a word naming its state.
     */
    for (const testCase of CASES.filter((c) => !c.inPublicCatalogue)) {
      const html = await renderToursPage([testCase.row]);
      const reason = publicWithholdReason(testCase.row);

      const explained =
        (reason === 'DRAFT' && html.includes('Draft')) ||
        (reason === 'ARCHIVED' && html.includes('Archived')) ||
        (reason === 'PRICE_UNCONFIRMED' && html.includes('Withheld from the public site'));

      expect({ reason, explained }).toEqual({ reason, explained: true });
    }
  });
});

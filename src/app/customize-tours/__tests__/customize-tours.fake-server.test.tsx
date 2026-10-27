/**
 * @jest-environment node
 */
import { renderToStaticMarkup } from 'react-dom/server.node';

import { FakeCrmServer, defaultFakeCrmState } from '@/server/crm/test-support/fake-crm-server';
import type { CrmPlace } from '@/server/crm/types';

import CustomizeToursPage from '../page';

/**
 * Production incident 2026-10-27, Bug 2: a real place ("Kedarnath") added
 * in the CRM did not appear on `/customize-tours` at all, per the report.
 *
 * Investigated in the order the incident report specified:
 *  a) Response shape — `GET /public/places` is a bare array both in the
 *     contract and in this client's own `getPlaces()`; no mismatch there.
 *     The real field-name drift (`liveTours` vs. the contract's
 *     documented `liveTourCount`) and the missing `description` field ARE
 *     real and are now tolerated by `crmPlaceSchema` (schemas.ts) — but
 *     reproduced here directly, neither one breaks rendering, because
 *     `/customize-tours` never reads `liveTourCount`/`description` at all
 *     (confirmed by grep before writing this test).
 *  b) `showInCustomBuilder` filtering — `CustomizeToursPage` filters
 *     ONLY by `showInCustomBuilder` (`src/app/customize-tours/page.tsx`
 *     line ~49); there is no additional `liveTourCount > 0` filter
 *     anywhere in this page's component tree, confirmed by grep. A place
 *     with zero live tours was never excluded by this site's own code.
 *  c)/d) Images — see `PhotoPlaceholder`'s `onError` fallback (added this
 *     same incident) and `next.config.ts`'s `images.remotePatterns`.
 *
 * Net finding: this page's rendering code was not the bug. These tests
 * exist as the regression guard for exactly the gaps that WERE real (the
 * field-name drift, the missing field, and bug 2b's "don't filter by live
 * tour count here" requirement) so they stay fixed.
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

/**
 * The EXACT real production payload reported for Kedarnath — `liveTours`
 * (not the contract's `liveTourCount`) and no `description` at all. Cast
 * through `unknown` deliberately: this is what the WIRE actually sends,
 * which is not assignable to the already-normalised `CrmPlace` TS type.
 */
const KEDARNATH_REAL_PAYLOAD = {
  name: 'Kedarnath',
  slug: 'kedarnath',
  region: 'Uttarakhand',
  showInCustomBuilder: true,
  imageUrl: 'https://media.gurujitravelyatra.com/place-images/abc123.webp',
  liveTours: 0,
} as unknown as CrmPlace;

describe('/customize-tours against the real-shaped Kedarnath payload', () => {
  it('renders the Kedarnath card, surviving both the liveTours field-name drift and the missing description', async () => {
    server.setState({ places: [KEDARNATH_REAL_PAYLOAD], site: defaultFakeCrmState().site });

    const element = await CustomizeToursPage();
    const html = renderToStaticMarkup(element);

    expect(html).toContain('Kedarnath');
  });

  it('a place with liveTourCount: 0 (the normalised, documented field name) still renders — bug 2b', async () => {
    const zeroLiveTours: CrmPlace = {
      name: 'Kedarnath',
      slug: 'kedarnath',
      region: 'Uttarakhand',
      description: 'A sacred temple town in the Garhwal Himalayas.',
      imageUrl: 'https://media.gurujitravelyatra.com/place-images/abc123.webp',
      showInCustomBuilder: true,
      liveTourCount: 0,
    };
    server.setState({ places: [zeroLiveTours] });

    const element = await CustomizeToursPage();
    const html = renderToStaticMarkup(element);

    expect(html).toContain('Kedarnath');
  });

  it('a place with showInCustomBuilder: false is correctly absent — the one filter this page is supposed to apply', async () => {
    server.setState({ places: [{ ...KEDARNATH_REAL_PAYLOAD, showInCustomBuilder: false }] });

    const element = await CustomizeToursPage();
    const html = renderToStaticMarkup(element);

    expect(html).not.toContain('Kedarnath');
  });

  it('renders successfully with an entirely empty places list, not a crash', async () => {
    server.setState({ places: [] });

    const element = await CustomizeToursPage();
    expect(() => renderToStaticMarkup(element)).not.toThrow();
  });
});

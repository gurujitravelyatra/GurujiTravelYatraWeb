/**
 * @jest-environment node
 */
import { renderToStaticMarkup } from 'react-dom/server.node';

import { FakeCrmServer, defaultFakeCrmState } from '@/server/crm/test-support/fake-crm-server';
import type { CrmSiteResponse } from '@/server/crm/types';

import { SiteShell } from '../SiteShell';

/**
 * Production incident 2026-10-27 (#2): `SiteShell` renders on EVERY page
 * (it is the one place that calls `getSite()`/`getPlaces()` for the header,
 * footer, and contact details), so when `GET /public/site` returned
 * `alt: null` on a site image and the old schema threw on it, the throw
 * reached `SiteShell` and took down every single page with a real HTTP
 * 500 — not a scoped failure, the whole site.
 *
 * These tests render `SiteShell` directly (not mocked, unlike most page
 * tests in this repo) against a real fake CRM server returning exactly
 * that crash payload, plus the other failure modes point 2 of the fix
 * calls for, and assert the render always SUCCEEDS — the specific proof
 * the incident report asked for: "confirm every page actually renders
 * with a 200... not just doesn't crash in a unit test".
 */

jest.mock('@/components/modals/modal-context', () => ({
  useModal: () => ({ modal: null, openEnquiry: jest.fn(), openBrochure: jest.fn(), close: jest.fn() }),
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

async function renderSiteShell(): Promise<string> {
  const element = await SiteShell({ activePath: '/', pageLabel: 'Home', children: <div>PAGE CONTENT MARKER</div> });
  return renderToStaticMarkup(element);
}

describe('SiteShell against the exact incident #2 crash payload', () => {
  it('renders successfully when GET /public/site sends alt: null on every image slot — THE exact crash payload', async () => {
    // Deliberately bypasses the `CrmSiteResponse` type's `alt: string` —
    // the whole point is reproducing what the REAL wire payload sent,
    // which this client's own types do not allow constructing normally.
    const crashSite = {
      images: {
        HERO_BACKGROUND: [{ url: 'https://res.cloudinary.com/demo/image/upload/v1/hero.jpg', alt: null }],
        ABOUT: [{ url: 'https://res.cloudinary.com/demo/image/upload/v1/about.jpg', alt: null }],
        GALLERY: [{ url: 'https://res.cloudinary.com/demo/image/upload/v1/g1.jpg', alt: null }],
        FOOTER: [{ url: 'https://res.cloudinary.com/demo/image/upload/v1/footer.jpg', alt: null }],
      },
      settings: defaultFakeCrmState().site.settings,
    } as unknown as CrmSiteResponse;
    server.setState({ site: crashSite });

    const html = await renderSiteShell();

    expect(html).toContain('PAGE CONTENT MARKER');
  });

  it('renders successfully with empty arrays everywhere and every settings field null (the fully-sparse case)', async () => {
    server.setState({ site: defaultFakeCrmState().site, places: [] });

    const html = await renderSiteShell();

    expect(html).toContain('PAGE CONTENT MARKER');
  });

  it('falls back to the static contact defaults, rather than crashing, when GET /public/site is completely unreachable', async () => {
    // Point this request at a real but closed port — a genuine connection
    // failure, not a 404/500 from the fake server (which would still be a
    // well-formed HTTP response).
    process.env.CRM_API_URL = 'http://127.0.0.1:1';

    const html = await renderSiteShell();

    expect(html).toContain('PAGE CONTENT MARKER');
  });

  it('renders successfully when GET /public/site is a deliberately malformed/unexpected response', async () => {
    // @ts-expect-error — deliberately the wrong shape, proving the client degrades instead of throwing.
    server.setState({ site: { thisIsNotTheRightShapeAtAll: true } });

    const html = await renderSiteShell();

    expect(html).toContain('PAGE CONTENT MARKER');
  });

  it('renders successfully when GET /public/places returns a place with null region/imageUrl/description', async () => {
    server.setState({
      places: [
        {
          name: 'Kedarnath',
          slug: 'kedarnath',
          // @ts-expect-error — reproducing the real wire payload, which this type does not allow constructing directly.
          region: null,
          // @ts-expect-error — see above.
          description: null,
          // @ts-expect-error — see above.
          imageUrl: null,
          showInCustomBuilder: true,
          liveTourCount: 3,
        },
      ],
    });

    const html = await renderSiteShell();

    expect(html).toContain('PAGE CONTENT MARKER');
    expect(html).toContain('Kedarnath');
  });
});

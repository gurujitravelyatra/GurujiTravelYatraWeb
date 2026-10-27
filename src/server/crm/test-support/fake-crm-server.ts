import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import type {
  CrmCategory,
  CrmCategoryCount,
  CrmDeparturesResponse,
  CrmEnquiryRequest,
  CrmPlace,
  CrmSiteResponse,
  CrmSitemapEntry,
  CrmTourCard,
  CrmTourDetail,
  CrmTourRedirect,
} from '../types';

/**
 * CRM-migration Step 6 — a real, local, in-memory HTTP server implementing
 * just enough of `documentation/technical-specification/public-website.md`
 * to exercise `@/server/crm/client` (and anything built on it) over an
 * ACTUAL network socket, not a mocked `fetch`. `src/server/crm/
 * __tests__/client.test.ts`'s own header explains the split: that file
 * proves "does this function build the URL/headers/body I expect" against
 * a stubbed `fetch`; this file is for "does the whole request/response
 * round-trip actually work", which a stub cannot prove no matter how
 * carefully it is written.
 *
 * ## This is NOT a real CRM, and is never mistaken for one
 *
 * It binds to `127.0.0.1` on an OS-assigned ephemeral port
 * (`listen(0, ...)`), lives only for the length of one test file, and is
 * torn down in `afterAll`. Nothing here calls out to Cloudflare, a real
 * database, or the internet — `submitEnquiry()`'s own doc comment says
 * "NEVER CALL THIS FROM A TEST AGAINST THE REAL CRM... every test in this
 * repo must point `CRM_API_URL` at a local fake server", and this is that
 * server. A test using it sets `CRM_API_URL` to `fakeCrmServer.url` for
 * the duration of the test and restores the original value afterward —
 * never anything that could resolve to `crm.gurujitravelyatra.com` or the
 * Railway-internal address.
 *
 * ## Fixtures are mutable per test, not hardcoded
 *
 * Every GET route reads from `this.state`, which a test can replace
 * wholesale (`server.setState({ tours: [...] })`) before making a request
 * — so a test can exercise "no tours match", "a redirected slug", "a
 * genuinely missing slug" etc. without forking the server.
 */

export interface FakeCrmState {
  tours: CrmTourCard[];
  tourDetails: Record<string, CrmTourDetail | CrmTourRedirect>;
  departures: CrmDeparturesResponse;
  places: CrmPlace[];
  site: CrmSiteResponse;
  categories: CrmCategoryCount[];
  sitemap: CrmSitemapEntry[];
  /** `x-website-api-key` every `POST /public/enquiries` call must carry. `undefined` disables the check (503, matching the real contract's "WEBSITE_API_KEY unset"). */
  websiteApiKey: string | undefined;
  /**
   * When true, `POST /public/enquiries` answers `400 VALIDATION_FAILED`
   * unconditionally — simulating a Turnstile token Cloudflare rejected (or
   * one that expired), which this fake server has no real Cloudflare to
   * actually verify against. Checked AFTER the API-key gate, same order
   * the real contract's "Protection, in order" documents.
   */
  rejectEnquiriesAsInvalid: boolean;
  /**
   * Fault injection: when true, EVERY route answers 500 with a plain-text
   * body — not the `{statusCode, error, message:{code,message}}` envelope
   * `isErrorBody()` (client.ts) recognises. Exists to exercise the one
   * client path a well-behaved fake server otherwise cannot reach:
   * `CrmUnexpectedResponseError`, for a response that is neither a success
   * body nor the documented error shape.
   */
  forceUnrecognisedErrorBody: boolean;
}

export function defaultFakeCrmState(): FakeCrmState {
  return {
    tours: [],
    tourDetails: {},
    departures: { departures: [], months: [] },
    places: [],
    site: {
      images: { HERO_BACKGROUND: [], ABOUT: [], GALLERY: [], FOOTER: [] },
      settings: {
        heroHeadline: null,
        heroSubtext: null,
        happyTravellersLabel: null,
        destinationsLabel: null,
        yearsExperienceLabel: null,
        showFiguresNote: false,
        phone: null,
        whatsappNumber: null,
        email: null,
        instagramUrl: null,
        address: null,
        profileVideoUrl: null,
      },
    },
    categories: [],
    sitemap: [],
    websiteApiKey: 'fake-crm-test-api-key',
    forceUnrecognisedErrorBody: false,
    rejectEnquiriesAsInvalid: false,
  };
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(text) });
  res.end(text);
}

/** The exact envelope `CrmApiError` (client.ts) parses. */
function sendCrmError(res: ServerResponse, status: number, code: string, message: string): void {
  send(res, status, { statusCode: status, error: code, message: { code, message } });
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export class FakeCrmServer {
  private server: Server | null = null;
  private state: FakeCrmState = defaultFakeCrmState();
  /** Every `POST /public/enquiries` body this server has received, in order — the whole point of a fake server over a mocked fetch is that a test can prove the REAL client sent a REAL, parseable HTTP request body. */
  readonly receivedEnquiries: CrmEnquiryRequest[] = [];
  /** Every `x-website-api-key` header value received, correct or not — lets a test prove a secret was sent without the fake server ever logging or exposing it elsewhere. */
  readonly receivedApiKeys: Array<string | undefined> = [];

  get url(): string {
    if (!this.server) throw new Error('FakeCrmServer.start() has not been called yet.');
    const address = this.server.address();
    if (!address || typeof address === 'string') throw new Error('FakeCrmServer has no TCP address.');
    return `http://127.0.0.1:${address.port}/api`;
  }

  setState(patch: Partial<FakeCrmState>): void {
    this.state = { ...this.state, ...patch };
  }

  resetState(): void {
    this.state = defaultFakeCrmState();
    this.receivedEnquiries.length = 0;
    this.receivedApiKeys.length = 0;
  }

  async start(): Promise<void> {
    this.server = createServer((req, res) => this.handle(req, res));
    await new Promise<void>((resolve) => this.server!.listen(0, '127.0.0.1', resolve));
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>((resolve, reject) =>
      this.server!.close((error) => (error ? reject(error) : resolve()))
    );
    this.server = null;
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      if (this.state.forceUnrecognisedErrorBody) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('internal server error (not the documented envelope)');
        return;
      }

      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const path = url.pathname.replace(/^\/api/, '');
      const method = req.method ?? 'GET';

      if (method === 'GET' && path === '/public/tours') return this.handleTours(url, res);
      if (method === 'GET' && path.startsWith('/public/tours/')) {
        return this.handleTourBySlug(decodeURIComponent(path.slice('/public/tours/'.length)), res);
      }
      if (method === 'GET' && path === '/public/departures') return send(res, 200, this.state.departures);
      if (method === 'GET' && path === '/public/places') return send(res, 200, this.state.places);
      if (method === 'GET' && path === '/public/site') return send(res, 200, this.state.site);
      if (method === 'GET' && path === '/public/categories') return send(res, 200, this.state.categories);
      if (method === 'GET' && path === '/public/sitemap') return send(res, 200, this.state.sitemap);
      if (method === 'POST' && path === '/public/enquiries') return await this.handleEnquiry(req, res);

      sendCrmError(res, 404, 'NOT_FOUND', `No fake route for ${method} ${path}`);
    } catch (error) {
      // A bug in the fake server itself should fail the test loudly, not
      // hang the request — mirrors a real server's own 500 shape.
      sendCrmError(res, 500, 'INTERNAL', error instanceof Error ? error.message : String(error));
    }
  }

  private handleTours(url: URL, res: ServerResponse): void {
    const category = url.searchParams.get('category') as CrmCategory | null;
    const place = url.searchParams.get('place');
    const q = url.searchParams.get('q');
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('pageSize') ?? '12');

    let filtered = this.state.tours;
    if (category) filtered = filtered.filter((tour) => tour.category === category);
    if (place) filtered = filtered.filter((tour) => tour.primaryPlace.slug === place);
    if (q) filtered = filtered.filter((tour) => tour.name.toLowerCase().includes(q.toLowerCase()));

    const start = (page - 1) * pageSize;
    const tours = filtered.slice(start, start + pageSize);

    send(res, 200, { tours, total: filtered.length, page, pageSize });
  }

  private handleTourBySlug(slug: string, res: ServerResponse): void {
    const entry = this.state.tourDetails[slug];
    if (!entry) {
      sendCrmError(res, 404, 'NOT_FOUND', `No fake tour for slug "${slug}".`);
      return;
    }
    send(res, 200, entry);
  }

  private async handleEnquiry(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const apiKey = req.headers['x-website-api-key'];
    const providedKey = Array.isArray(apiKey) ? apiKey[0] : apiKey;
    this.receivedApiKeys.push(providedKey);

    // Mirrors the contract's own "Protection, in order": WEBSITE_API_KEY
    // unset is 503 before anything else runs.
    if (this.state.websiteApiKey === undefined) {
      sendCrmError(res, 503, 'NOT_CONFIGURED', 'WEBSITE_API_KEY is not configured on this fake CRM.');
      return;
    }
    if (providedKey !== this.state.websiteApiKey) {
      sendCrmError(res, 401, 'API_KEY_INVALID', 'Missing or incorrect x-website-api-key.');
      return;
    }

    if (this.state.rejectEnquiriesAsInvalid) {
      sendCrmError(res, 400, 'VALIDATION_FAILED', 'Turnstile rejected the token (simulated).');
      return;
    }

    const raw = await readBody(req);
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      sendCrmError(res, 400, 'VALIDATION_FAILED', 'Malformed JSON body.');
      return;
    }

    const enquiry = body as CrmEnquiryRequest;

    // Honeypot short-circuits BEFORE Turnstile is ever considered, per the
    // contract's own "Protection, in order" step 2 — recorded here too,
    // deliberately, so a test can prove a bot submission still reached
    // nothing beyond this check (`receivedEnquiries` still gets the
    // record, for inspection, but no further validation runs on it).
    if (enquiry.honeypot) {
      this.receivedEnquiries.push(enquiry);
      send(res, 200, { ok: true });
      return;
    }

    if (!enquiry.consent || !enquiry.turnstileToken) {
      sendCrmError(res, 400, 'VALIDATION_FAILED', 'consent and turnstileToken are required.');
      return;
    }

    // This fake server has no real Cloudflare to check a token against —
    // it accepts any non-empty token as "verified", which is exactly the
    // boundary described in TurnstileWidget.tsx's own header: verification
    // itself happens on a real CRM, against real Cloudflare, never here.
    this.receivedEnquiries.push(enquiry);
    send(res, 200, { ok: true });
  }
}

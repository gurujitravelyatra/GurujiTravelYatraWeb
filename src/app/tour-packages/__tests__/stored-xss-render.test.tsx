import { renderToStaticMarkup } from 'react-dom/server.node';

import { PackageCard } from '@/components/cards/PackageCard';
import { isSafeMediaUrl } from '@/lib/cloudinary-url';
import type { CrmTourDetail } from '@/server/crm/types';

import PackageDetailPage, { generateMetadata } from '../[slug]/page';

/**
 * STORED XSS — the RENDER half.
 *
 * `src/server/admin/tours/__tests__/stored-xss.test.ts` (admin-only, being
 * removed with the rest of the admin CMS in a later migration step) proved a
 * payload could not be SAVED through that form. This file proves the
 * independent thing that survives that removal: if a hostile string ever
 * reaches this page's render path — now exclusively via the CRM response,
 * since there is no longer a database this site writes to at all — the
 * bytes a visitor receives still contain nothing a browser will execute.
 *
 * Same technique as before: `renderToStaticMarkup` (the real server
 * renderer) + `DOMParser`, asking structural questions rather than
 * pattern-matching strings. See the original file's header, preserved in
 * spirit, for why.
 */

jest.mock('@/components/modals/modal-context', () => ({
  useModal: () => ({ modal: null, openEnquiry: jest.fn(), openBrochure: jest.fn(), close: jest.fn() }),
}));

/**
 * `SiteShell` is now an async Server Component (`GET /public/site`/
 * `/public/places` for the chrome). `renderToStaticMarkup` cannot await a
 * nested async component — it suspends — so it is stubbed here exactly as
 * in `legal-pages.test.tsx`; this file is about the DETAIL PAGE's own XSS
 * handling, not site-chrome wiring.
 */
jest.mock('@/components/layout/SiteShell', () => ({
  SiteShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

const mockGetTourBySlug = jest.fn();

jest.mock('@/server/crm/client', () => ({
  getTourBySlug: (slug: string) => mockGetTourBySlug(slug),
}));

/**
 * One payload per rendered field, all different, so a failure names which
 * field leaked. `durationDays`/`durationNights` are plain numbers in the CRM
 * shape — not injectable — so that attack surface from the old free-text
 * `durationLabel` is gone entirely; the fields below cover what is still
 * free text.
 */
const PLANTED: CrmTourDetail = {
  slug: 'compromised-tour',
  name: '<script>alert("name")</script>',
  category: '<svg/onload=alert("cat")>' as CrmTourDetail['category'],
  shortDescription: '"><script>alert("short")</script>',
  coverImageUrl: 'javascript:alert("cover")',
  price: { amount: 42500, currency: 'INR' },
  durationDays: 6,
  durationNights: 5,
  departureCity: null,
  primaryPlace: { name: '<img src=x onerror=alert("place")>', slug: 'spiti-valley' },
  nextDeparture: null,
  hasBrochure: false,
  description: '<body onload=alert("description")>',
  highlights: ['<script>alert("highlight")</script>'],
  itinerary: [{ day: 1, title: '<script>alert("day")</script>', detail: '<iframe src="javascript:alert(1)"></iframe>' }],
  inclusions: ['<script>alert("inclusion")</script>'],
  exclusions: ['<script>alert("exclusion")</script>'],
  cancellationPolicy: '<script>alert("policy")</script>',
  gallery: [
    { url: 'https://res.cloudinary.com/demo/image/upload/v1/g1.jpg', alt: 'a safe gallery image' },
    { url: 'javascript:alert("gallery")', alt: 'hostile' },
    // Whitespace/control characters are stripped by a browser before the
    // scheme is read, so this is a live `javascript:` URL to everything that
    // matters and a novel string to a naive `startsWith('javascript:')`.
    { url: ' java\tscript:alert("gallery-obfuscated")', alt: 'hostile' },
    { url: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==', alt: 'hostile' },
    // Right host NAME, wrong host — the classic prefix-check bypass.
    { url: 'https://res.cloudinary.com.evil.example/image/upload/v1/x.jpg', alt: 'hostile' },
  ],
  brochureUrl: null,
  places: [],
  pricingOptions: [],
  departures: [],
  seoTitle: '<script>alert("seo-title")</script>',
  seoDescription: '"><script>alert("seo-description")</script>',
};

/** Tags that execute, navigate or embed. None belongs in rendered tour copy. */
const DANGEROUS_TAGS = ['script', 'iframe', 'object', 'embed', 'base', 'form'];

/** Attributes whose value a browser may follow as a URL. */
const URL_ATTRIBUTES = ['href', 'src', 'action', 'formaction', 'xlink:href'];

function executableFindings(html: string): string[] {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const findings: string[] = [];

  for (const tag of DANGEROUS_TAGS) {
    const count = document.querySelectorAll(tag).length;
    if (count > 0) findings.push(`${count} <${tag}> element(s)`);
  }

  for (const element of Array.from(document.querySelectorAll('*'))) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();

      if (name.startsWith('on')) {
        findings.push(`<${element.tagName.toLowerCase()} ${name}=…>`);
      }

      if (URL_ATTRIBUTES.includes(name)) {
        const value = attribute.value.replace(/[\u0000- ]/g, '').toLowerCase();
        if (value.startsWith('javascript:') || value.startsWith('data:text/html')) {
          findings.push(`<${element.tagName.toLowerCase()} ${name}="${attribute.value}">`);
        }
      }
    }
  }

  return findings;
}

describe('a tour whose CRM response is full of XSS payloads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTourBySlug.mockResolvedValue({ status: 'found', tour: PLANTED });
  });

  it('renders a detail page a browser will execute nothing from', async () => {
    const element = await PackageDetailPage({ params: Promise.resolve({ slug: PLANTED.slug }) });

    expect(executableFindings(renderToStaticMarkup(element))).toEqual([]);
  });

  it('renders a package card a browser will execute nothing from', () => {
    expect(executableFindings(renderToStaticMarkup(<PackageCard tour={PLANTED} />))).toEqual([]);
  });

  it('escapes the payload into visible text rather than dropping it silently', async () => {
    const element = await PackageDetailPage({ params: Promise.resolve({ slug: PLANTED.slug }) });
    const html = renderToStaticMarkup(element);

    expect(html).toContain('&lt;script&gt;alert(&quot;name&quot;)&lt;/script&gt;');

    const document = new DOMParser().parseFromString(html, 'text/html');
    expect(document.body.textContent).toContain('<script>alert("name")</script>');
  });

  it('puts the payload in metadata as data, not as markup', async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: PLANTED.slug }) });

    expect(metadata.title).toBe(PLANTED.seoTitle);
    expect(typeof metadata.description).toBe('string');

    const html = renderToStaticMarkup(<meta name="description" content={String(metadata.description)} />);
    expect(executableFindings(html)).toEqual([]);
    expect(html).toContain('&quot;&gt;&lt;script&gt;');
  });

  it('renders the one legitimate gallery image and drops the hostile ones', async () => {
    const element = await PackageDetailPage({ params: Promise.resolve({ slug: PLANTED.slug }) });
    const html = renderToStaticMarkup(element);

    expect(html).toContain('res.cloudinary.com/demo/image/upload');

    const document = new DOMParser().parseFromString(html, 'text/html');
    const gallery = document.querySelector('section[aria-labelledby="tour-gallery-heading"]');
    expect(gallery).not.toBeNull();

    const urls = [
      ...Array.from(gallery!.querySelectorAll('a[href]')).map((a) => a.getAttribute('href') ?? ''),
      ...Array.from(document.querySelectorAll('img[src]')).map((img) => img.getAttribute('src') ?? ''),
    ];

    expect(urls.length).toBeGreaterThan(0);
    expect(urls.filter((url) => !url.startsWith('https://res.cloudinary.com/') && !url.startsWith('/'))).toEqual([]);
    expect(gallery!.querySelectorAll('a[href]').length).toBe(1);
  });

  it('falls back to the placeholder for a hostile COVER url rather than emitting it', async () => {
    const element = await PackageDetailPage({ params: Promise.resolve({ slug: PLANTED.slug }) });
    const html = renderToStaticMarkup(element);

    expect(html).not.toContain('src="javascript:');
    expect(html).toContain('Image placeholder');
  });

  it('the lookalike host does not satisfy the check', () => {
    expect(isSafeMediaUrl('https://res.cloudinary.com.evil.example/image/upload/v1/x.jpg')).toBe(false);
    expect(isSafeMediaUrl('https://res.cloudinary.com/demo/image/upload/v1/g1.jpg')).toBe(true);
  });
});

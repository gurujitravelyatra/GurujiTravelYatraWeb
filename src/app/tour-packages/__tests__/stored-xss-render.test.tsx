import { renderToStaticMarkup } from 'react-dom/server.node';

import { PackageCard } from '@/components/cards/PackageCard';
import { toTourJson } from '@/app/api/_lib/serializers';
import type { Package } from '@/content/types';

import PackageDetailPage, { generateMetadata } from '../[slug]/page';

/**
 * STORED XSS — the RENDER half, Phase D.
 *
 * `src/server/admin/tours/__tests__/stored-xss.test.ts` proves a payload cannot
 * be SAVED. This file proves the other, independent thing: that if one were
 * already in the database — planted before Phase D, restored from a backup,
 * written by a direct SQL edit — the public page a visitor receives still
 * contains nothing a browser will execute.
 *
 * ## It renders the real server output and then PARSES it
 *
 * Two things had to be true for this test to mean anything, and each ruled out
 * the obvious approach:
 *
 *  1. **It must inspect the bytes the server sends, not the DOM React built.**
 *     `screen.getByText('<script>alert(1)</script>')` passes whether React
 *     escaped the payload or executed it — by the time Testing Library queries,
 *     the browser has already decided and discarded the evidence. So the page is
 *     rendered with `renderToStaticMarkup`, the same server renderer Next uses.
 *     (`react-dom/server.node` explicitly: under jsdom, the bare
 *     `react-dom/server` specifier resolves to the BROWSER build, which needs
 *     `MessageChannel` and throws on import.)
 *
 *  2. **It must decide "is this executable" the way a browser does, by PARSING
 *     the string — not by pattern-matching it.** The first version of this file
 *     used regexes and produced two false positives immediately, both
 *     instructive: the page's own legitimate `<img>` carries an `alt` attribute
 *     containing the words `onerror=...` as escaped text, and the escaped copy of
 *     the payload contains the characters `javascript:`. Both are inert — text in
 *     an attribute value is data — but `/onerror=/` cannot tell that, and a
 *     security test that cries wolf gets deleted. `DOMParser` builds the same
 *     tree a browser would and the assertions ask it structural questions:
 *     are there script elements, does any element carry an event-handler
 *     attribute, does any URL attribute hold a `javascript:` scheme.
 *
 * This is the regression guard for the change that would actually reintroduce
 * the bug — someone adding `dangerouslySetInnerHTML` to a public page. That turns
 * an escaped `&lt;script&gt;` into a real `<script>` element, and these
 * assertions fail. `no-raw-html-render.test.ts` is the blunter companion: it
 * asserts the repository contains no `dangerouslySetInnerHTML` at all.
 */

jest.mock('@/components/modals/modal-context', () => ({
  useModal: () => ({ modal: null, openEnquiry: jest.fn(), openBrochure: jest.fn(), close: jest.fn() }),
}));

const mockGetPackageBySlug = jest.fn();

jest.mock('@/content/get-all-packages', () => ({
  getAllPackages: jest.fn().mockResolvedValue([]),
  getPackageBySlug: (slug: string) => mockGetPackageBySlug(slug),
}));

/**
 * One payload per rendered field, all different, so a failure names which field
 * leaked rather than just "something did". Every field below is one the public
 * detail page or the package card actually prints today.
 */
const PLANTED: Package = {
  slug: 'compromised-tour',
  name: '<script>alert("name")</script>',
  destinationSlug: 'spiti-valley',
  destinationName: '<img src=x onerror=alert("dest")>',
  category: '<svg/onload=alert("cat")>' as Package['category'],
  durationLabel: '"><script>alert("duration")</script>',
  subtitle: '<iframe src="javascript:alert(\'subtitle\')"></iframe>',
  photoUrl: 'Spiti Valley',
  coverImageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/cover.jpg',
  galleryImageUrls: ['https://res.cloudinary.com/demo/image/upload/v1/g1.jpg'],
  photosCount: 11,
  priceFrom: '<body onload=alert("price")>₹42,500',
  priceWas: '<a href="javascript:alert(\'was\')">₹50,000</a>',
  savingsLabel: '<scr<script>ipt>alert("savings")</script>7,500',
  seatsLabel: '<script>alert("seats")</script>',
  isHot: true,
} as Package;

/** Tags that execute, navigate or embed. None belongs in rendered tour copy. */
const DANGEROUS_TAGS = ['script', 'iframe', 'object', 'embed', 'base', 'form'];

/** Attributes whose value a browser may follow as a URL. */
const URL_ATTRIBUTES = ['href', 'src', 'action', 'formaction', 'xlink:href'];

/**
 * Asks the parsed document the questions a browser would, and reports EVERY
 * violation at once rather than failing on the first — a leak is usually a
 * field, and seeing all of them names the field.
 */
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

      // `on…` is every inline event handler there is. An attribute named this
      // way exists only because markup was parsed, never because text was
      // escaped, so its presence IS the bug.
      if (name.startsWith('on')) {
        findings.push(`<${element.tagName.toLowerCase()} ${name}=…>`);
      }

      if (URL_ATTRIBUTES.includes(name)) {
        // Leading control characters and whitespace are stripped by browsers
        // before the scheme is read, so `  java\tscript:` is a live URL. The
        // comparison has to do the same or it is checking a different string
        // than the browser will.
        const value = attribute.value.replace(/[\u0000-\u0020]/g, '').toLowerCase();
        if (value.startsWith('javascript:') || value.startsWith('data:text/html')) {
          findings.push(`<${element.tagName.toLowerCase()} ${name}="${attribute.value}">`);
        }
      }
    }
  }

  return findings;
}

describe('a tour whose stored copy is full of XSS payloads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPackageBySlug.mockResolvedValue(PLANTED);
  });

  it('renders a detail page a browser will execute nothing from', async () => {
    const element = await PackageDetailPage({ params: Promise.resolve({ slug: PLANTED.slug }) });

    expect(executableFindings(renderToStaticMarkup(element))).toEqual([]);
  });

  it('renders a package card a browser will execute nothing from', () => {
    expect(executableFindings(renderToStaticMarkup(<PackageCard package={PLANTED} />))).toEqual([]);
  });

  it('escapes the payload into visible text rather than dropping it silently', async () => {
    // The complement of the assertions above, and it matters: a test that only
    // checked "nothing executable" would also pass if the page rendered nothing
    // at all, hiding a rendering bug behind a security result.
    const element = await PackageDetailPage({ params: Promise.resolve({ slug: PLANTED.slug }) });
    const html = renderToStaticMarkup(element);

    // Note the `&quot;` — React escapes the double quotes inside the payload too,
    // not only the angle brackets, because the same string is also interpolated
    // into the hero image's `alt` attribute on this page.
    expect(html).toContain('&lt;script&gt;alert(&quot;name&quot;)&lt;/script&gt;');

    // And the payload survives as TEXT in the parsed tree — i.e. a visitor sees
    // the characters, which is the correct (if ugly) outcome for copy that
    // should never have been stored.
    const document = new DOMParser().parseFromString(html, 'text/html');
    expect(document.body.textContent).toContain('<script>alert("name")</script>');
  });

  /**
   * `generateMetadata` interpolates `durationLabel` and `subtitle` into the
   * page's `<meta name="description">`. That is a different escaping CONTEXT —
   * an attribute value rather than element text — and `"><script>` is the payload
   * written for exactly that context: it closes the attribute and the tag before
   * opening its own.
   */
  it('puts the payload in metadata as data, not as markup', async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: PLANTED.slug }) });

    expect(metadata.title).toBe(PLANTED.name);
    expect(typeof metadata.description).toBe('string');

    const html = renderToStaticMarkup(<meta name="description" content={String(metadata.description)} />);
    expect(executableFindings(html)).toEqual([]);
    // The breakout attempt is still there — neutralised, not removed.
    expect(html).toContain('&quot;&gt;&lt;script&gt;');
  });

  /**
   * The JSON API is the surface React's escaping does NOT cover: `/api/tours`
   * publishes this text to clients this repository does not own and cannot audit.
   * The response is `application/json`, so the payload is inert as DELIVERED —
   * it is inert only until somebody else's client renders it.
   *
   * This asserts the uncomfortable half honestly: the serializer does not
   * transform, so a payload in the database would be published verbatim. That is
   * the argument for cleaning at WRITE time (`sanitize-tour-text.ts`) instead of
   * trusting a renderer we do not own.
   */
  it('publishes stored text verbatim over the JSON API — which is why storage is cleaned', () => {
    const json = toTourJson(PLANTED);

    expect(json.name).toBe(PLANTED.name);
    expect(JSON.stringify(json)).toContain('<script>');
  });
});

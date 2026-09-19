import { renderToStaticMarkup } from 'react-dom/server.node';

import { PackageCard } from '@/components/cards/PackageCard';
import { toTourJson } from '@/app/api/_lib/serializers';
import { isSafeMediaUrl } from '@/lib/cloudinary-url';
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
  /**
   * MEDIA URLs — planted hostile, as of the 2026-09-19 review (L5).
   *
   * The first version of this fixture used two well-formed Cloudinary URLs,
   * which made the media half of every assertion below vacuous: the page could
   * have interpolated them into `href`/`src` with no checking whatsoever — and
   * it did — and the test would still have been green, because nothing it was
   * handed was dangerous.
   *
   * `cloudinaryUrl` in `tour-form-schema.ts` means these cannot be SAVED
   * through the admin. That is not the threat model here. This file's premise,
   * stated in its own header, is "if one were already in the database — planted
   * before Phase D, restored from a backup, written by a direct SQL edit". A
   * URL column is reachable by exactly the same routes as a text column, and it
   * is the more dangerous one: a stored `<script>` reaches a visitor as visible
   * characters, while a stored `javascript:` href reaches them as a live link.
   *
   * The gallery keeps one legitimate URL alongside the hostile ones, so the
   * assertions can tell "refused the bad URL" apart from "rendered no gallery".
   */
  coverImageUrl: 'javascript:alert("cover")' as string,
  galleryImageUrls: [
    'https://res.cloudinary.com/demo/image/upload/v1/g1.jpg',
    'javascript:alert("gallery")',
    // Whitespace and control characters are stripped by a browser before the
    // scheme is read, so this is a live `javascript:` URL to everything that
    // matters and a novel string to a naive `startsWith('javascript:')`.
    ' java\tscript:alert("gallery-obfuscated")',
    'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    // Right host name, wrong host — the classic prefix-check bypass.
    'https://res.cloudinary.com.evil.example/image/upload/v1/x.jpg',
  ],
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
  /**
   * L5 — THE MEDIA HALF, which the payload set above now actually exercises.
   *
   * `executableFindings` already asks whether any URL attribute holds a
   * `javascript:` or `data:text/html` scheme, so these payloads are covered by
   * the two assertions at the top of this file. What the tests below add is the
   * distinction those cannot make on their own: **refusing a hostile URL and
   * rendering no gallery at all look identical to an absence assertion.**
   */
  it('renders the one legitimate gallery image and drops the hostile ones', async () => {
    const element = await PackageDetailPage({ params: Promise.resolve({ slug: PLANTED.slug }) });
    const html = renderToStaticMarkup(element);

    // The safe URL survived — so the filter is a filter, not an off switch.
    expect(html).toContain('res.cloudinary.com/demo/image/upload');

    const document = new DOMParser().parseFromString(html, 'text/html');

    /**
     * Scoped to the MEDIA elements — the gallery section's own links, and every
     * `<img>` on the page — rather than to every `a[href]`. The site shell
     * legitimately renders `tel:`, `mailto:` and `https://wa.me/…` links in the
     * header and footer, and an allowlist that swept those up would either fail
     * on correct markup or have to be widened until it permitted the schemes
     * this test exists to forbid.
     */
    const gallery = document.querySelector('section[aria-labelledby="tour-gallery-heading"]');
    expect(gallery).not.toBeNull();

    const urls = [
      ...Array.from(gallery!.querySelectorAll('a[href]')).map((a) => a.getAttribute('href') ?? ''),
      ...Array.from(document.querySelectorAll('img[src]')).map((img) => img.getAttribute('src') ?? ''),
    ];

    // GUARD THE GUARD: the section really did emit URL-bearing elements to
    // inspect. An allowlist over an empty array is satisfied by anything.
    expect(urls.length).toBeGreaterThan(0);

    /**
     * Every one is either a Cloudinary delivery URL or a same-origin path.
     * Stated as an allowlist, because a blocklist of schemes is exactly what
     * `isSafeMediaUrl` exists to avoid having to maintain.
     *
     * Same-origin paths are permitted because the site shell's logo is a local
     * asset served through `/_next/image`. That is not tour data and cannot be
     * a payload — it is a relative path, so no scheme can be smuggled into it.
     */
    expect(
      urls.filter((url) => !url.startsWith('https://res.cloudinary.com/') && !url.startsWith('/'))
    ).toEqual([]);

    // Precisely one gallery item survived — the five hostile URLs were dropped,
    // and the drop is a filter rather than the section failing to render.
    expect(gallery!.querySelectorAll('a[href]').length).toBe(1);
  });

  it('falls back to the placeholder for a hostile COVER url rather than emitting it', async () => {
    const element = await PackageDetailPage({ params: Promise.resolve({ slug: PLANTED.slug }) });
    const html = renderToStaticMarkup(element);

    // The cover is `javascript:alert("cover")`. It must not reach a `src`...
    expect(html).not.toContain('src="javascript:');
    // ...and the slot must still render something, via the placeholder branch.
    expect(html).toContain('Image placeholder');
  });

  it('the lookalike host does not satisfy the check', () => {
    // `https://res.cloudinary.com.evil.example/…` starts with the right
    // CHARACTERS and is a different host. The prefix includes the trailing
    // slash precisely so this fails, and that is worth pinning directly rather
    // than inferring from the render.
    expect(isSafeMediaUrl('https://res.cloudinary.com.evil.example/image/upload/v1/x.jpg')).toBe(
      false
    );
    expect(isSafeMediaUrl('https://res.cloudinary.com/demo/image/upload/v1/g1.jpg')).toBe(true);
  });

  it('publishes stored text verbatim over the JSON API — which is why storage is cleaned', () => {
    const json = toTourJson(PLANTED);

    expect(json.name).toBe(PLANTED.name);
    expect(JSON.stringify(json)).toContain('<script>');
  });
});

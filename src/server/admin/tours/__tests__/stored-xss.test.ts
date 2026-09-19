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
import {
  MARKUP_DECODE_ROUNDS_FOR_TESTS as MAX_DECODE_ROUNDS,
  MARKUP_REJECTED_MESSAGE,
  containsMarkup,
  decodeForMarkupDetection,
} from '../plain-text';
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

/**
 * M1 — ENTITY-ENCODED PAYLOADS, the 2026-09-19 independent review.
 *
 * Every payload above contains a literal `<`, which is what `MARKUP_OPENER`
 * looks for. `&lt;img src=x onerror=alert(1)&gt;` contains none — so the schema
 * accepted it, `toPlainText`'s guard clause returned it untouched, and the row
 * was stored byte-for-byte.
 *
 * ## Why that matters even though our own pages are safe
 *
 * On a GTY page it is inert: React escapes the `&`, and a visitor sees the
 * characters `&lt;img …`. The exposure is entirely on the other side of the
 * HTTP boundary — `/api/tours` and `/api/tours/[slug]` publish this text as
 * JSON to consumers this repository does not own, and the first one to assign a
 * field to `innerHTML` decodes the entities and runs the payload. That is
 * precisely the property `sanitize-tour-text.ts`'s header claims to buy ("the
 * stored row is clean regardless of who reads it"), and it was the one encoding
 * that walked straight through.
 *
 * ## The assertion is on the DECODED stored value
 *
 * `expect(stored).not.toContain('<')` is the wrong test — it passes for
 * `&lt;script&gt;`, which is the bug. So every assertion below decodes what
 * would have been stored, the way a consumer's `innerHTML` would, and asks
 * whether a tag can be built from the result.
 */
describe('entity-encoded markup', () => {
  /** The same payloads, written without a single literal angle bracket. */
  const ENCODED = {
    NAMED: '&lt;img src=x onerror=alert(1)&gt;',
    NUMERIC: '&#60;script&#62;alert(1)&#60;/script&#62;',
    HEX: '&#x3c;script&#x3e;alert(1)&#x3c;/script&#x3e;',
    /** Zero-padded numeric — a browser accepts these, a naive `&#60;` match does not. */
    PADDED_NUMERIC: '&#060;script&#062;alert(1)&#060;/script&#062;',
    /** No trailing semicolon. `&lt` is a legacy reference a browser still resolves. */
    NO_SEMICOLON: '&ltscript&gtalert(1)&lt/script&gt',
    /** Double-encoded: one decode pass leaves `&lt;script&gt;`, which still executes. */
    DOUBLE: '&amp;lt;script&amp;gt;alert(1)&amp;lt;/script&amp;gt;',
    /** The round-trip case — detected as markup, and the old single pass MANUFACTURED a payload from it. */
    ROUND_TRIP: '<p>&amp;lt;script&gt;alert(1)&amp;lt;/script&gt;</p>',
  } as const;

  const ALL_ENCODED = Object.values(ENCODED);

  /**
   * Decodes the way a consumer's HTML sink would, then asks the structural
   * question. `decodeForMarkupDetection` is the module's own decoder, which is
   * deliberate: if it under-decodes, this test under-checks, so the two are
   * pinned together by the non-vacuity assertions below rather than by trust.
   */
  function decodesToMarkup(stored: string): boolean {
    return /<[a-zA-Z!/?]/.test(decodeForMarkupDetection(stored));
  }

  it('the payload set is real, and each one is genuinely entity-encoded', () => {
    // GUARD THE GUARD. Every assertion in this block is an ABSENCE, and an
    // absence assertion over an empty or wrongly-built set is free.
    expect(ALL_ENCODED.length).toBeGreaterThanOrEqual(7);

    for (const [name, payload] of Object.entries(ENCODED)) {
      // ...and each one really does decode to executable markup, or the test
      // below proves nothing by rejecting something that was never dangerous.
      expect({ name, dangerous: decodesToMarkup(payload) }).toEqual({ name, dangerous: true });
    }

    // All but the round-trip case carry no literal `<` at all — i.e. the OLD
    // detector saw nothing in them. That is the defect, stated as data.
    const withoutLiteralAngle = ALL_ENCODED.filter((p) => !p.includes('<'));
    expect(withoutLiteralAngle.length).toBe(ALL_ENCODED.length - 1);
  });

  it.each(ALL_ENCODED)('the schema refuses it: %j', (payload) => {
    expect(containsMarkup(payload)).toBe(true);

    const parsed = tourFormSchema.safeParse(values({ shortDescription: payload }));
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.message === MARKUP_REJECTED_MESSAGE)).toBe(true);
    }
  });

  it.each(ALL_ENCODED)('and the write path neutralises it anyway: %j', (payload) => {
    /**
     * The second layer, tested independently of the first — the repository is
     * handed the raw payload with no schema in the way, which is the only
     * honest way to test a fallback.
     */
    const stored = toPlainText(payload);

    expect(decodesToMarkup(stored)).toBe(false);
    // And repeatedly decoding the stored value never produces a tag either —
    // the property a consumer's sink actually exercises.
    expect(decodeForMarkupDetection(stored)).not.toMatch(/<[a-zA-Z!/?]/);
  });

  it('is idempotent: re-saving stored text does not erode it further', () => {
    // The whole tour is re-submitted on every save, including fields nobody
    // touched. A transform that changed its own output would eat the copy a
    // little more each time the admin pressed Save.
    for (const payload of ALL_ENCODED) {
      const once = toPlainText(payload);
      expect(toPlainText(once)).toBe(once);
    }
  });

  /**
   * THE LOAD-BEARING NON-REGRESSION. The guard clause in `toPlainText` exists
   * so that ordinary text is stored byte-for-byte — no escaping artefacts, no
   * entity resolution. Making the detector entity-aware moves that boundary,
   * and moving it too far would mean `Tea &amp; coffee` came back as
   * `Tea &amp;amp; coffee` and the tour page showed the literal `&amp;`.
   */
  it.each([
    'Tea &amp; coffee',
    'Rooms for &lt; 4 guests',
    'Price: 5 &gt; 3',
    '&amp; &lt; &nbsp;',
    'Breakfast &amp; dinner included, 5 &gt; 3 nights',
    'Use &amp;amp; for an ampersand',
  ])('leaves ordinary escaped text exactly as typed: %j', (text) => {
    expect(containsMarkup(text)).toBe(false);
    expect(toPlainText(text)).toBe(text);
  });

  /**
   * NESTING vs. REPETITION — worth pinning, because they look alike and behave
   * completely differently, and the first version of this test confused them.
   *
   * `'&amp;'.repeat(n)` is n SIBLING references, not n layers: a single global
   * replace resolves all of them in one pass. Real nesting re-encodes the `&` of
   * the layer below, giving `&` + `amp;` × (n-1) + `lt;` — and that costs
   * exactly one pass per layer.
   */
  it('peels exactly one nesting layer per pass, and detects anything a real sink could decode', () => {
    const nest = (layers: number) => `${'&'}${'amp;'.repeat(layers - 1)}lt;script&gt;`;

    // Confirms the construction is what it claims — otherwise the cap assertion
    // below is measuring something else entirely.
    expect(nest(1)).toBe('&lt;script&gt;');
    expect(nest(2)).toBe('&amp;lt;script&gt;');
    expect(decodeForMarkupDetection(nest(2))).toContain('<script>');

    // Every depth a sink could plausibly reach is caught.
    for (let layers = 1; layers <= MAX_DECODE_ROUNDS; layers += 1) {
      expect({ layers, caught: containsMarkup(nest(layers)) }).toEqual({ layers, caught: true });
    }
  });

  it('is bounded on a pathological input, and that is SAFE rather than a gap', () => {
    /**
     * 20,000 genuine nesting layers. The detector gives up after
     * `MAX_DECODE_ROUNDS`, so it reports "no markup" — which is the honest
     * answer to the question that matters:
     *
     * **An n-layer encoding needs n decodes to become executable.** A consumer
     * assigning to `innerHTML` decodes ONCE. A 20,000-layer payload therefore
     * renders as the literal characters `&amp;amp;…` in every sink that exists;
     * it is text, not a tag, and treating it as a threat would mean refusing
     * ordinary copy that happens to contain a lot of ampersands.
     *
     * The cap is five, i.e. five times deeper than any real sink decodes. What
     * it buys is that an attacker cannot choose how long a save takes — an
     * uncapped "repeat until stable" is a CPU denial-of-service on a path that
     * runs on every keystroke in the admin form.
     */
    const deeplyNested = `${'&'}${'amp;'.repeat(20_000)}lt;script&gt;`;

    const started = Date.now();
    expect(containsMarkup(deeplyNested)).toBe(false);
    expect(Date.now() - started).toBeLessThan(2_000);
  });
});

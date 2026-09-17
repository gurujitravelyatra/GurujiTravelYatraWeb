import { CATEGORY_TO_PRISMA } from '@/content/adapters/prisma-category';
import { AUDIENCE_TAG_TO_PRISMA, toDomainAudienceTag } from '@/content/adapters/prisma-audience-tag';

import {
  AUDIENCE_TAG_VALUES,
  CATEGORY_VALUES,
  isSubmitIntent,
  parseTourForm,
  publishableTourSchema,
  tourFormSchema,
  type TourFormValues,
} from '../tour-form-schema';

/**
 * The tour editor's validation contract.
 *
 * The interesting assertions here are about the DIFFERENCE between saving and
 * publishing. "Save as Draft" must accept work in progress, and "Publish" must
 * refuse anything that would render a broken card — and because both buttons
 * post to the same server action, the thing that keeps them apart is
 * `parseTourForm` picking the right schema. That is what these tests pin.
 */

/** The least a form can contain and still be saveable. */
const MINIMAL_DRAFT: TourFormValues = {
  name: 'Half Written Tour',
  slug: 'half-written-tour',
  destinationSlug: 'spiti-valley',
  category: 'Adventure',
  audienceTags: [],
  isHot: false,
  inclusions: [],
  exclusions: [],
  itineraryDays: [],
  faqs: [],
  pricingTiers: [],
};

const PUBLISHABLE: TourFormValues = {
  ...MINIMAL_DRAFT,
  name: 'Spiti Valley Circuit',
  slug: 'spiti-valley-circuit',
  shortDescription: 'A high-altitude loop through the Spiti valley.',
  durationLabel: '9 Days 8 Nights',
  priceFrom: '₹42,500',
};

describe('draft-level validation accepts work in progress', () => {
  it('saves a tour with nothing but a name, slug, destination and category', () => {
    const result = tourFormSchema.safeParse(MINIMAL_DRAFT);
    expect(result.success).toBe(true);
  });

  it('normalises an empty optional string to undefined rather than storing ""', () => {
    // So "not filled in" is one value, not two. `publishableTourSchema` checks
    // falsiness, and a stored '' that read as "present" would let an empty
    // description satisfy the publish bar.
    const result = tourFormSchema.parse({ ...MINIMAL_DRAFT, shortDescription: '   ' });
    expect(result.shortDescription).toBeUndefined();
  });

  it('still rejects a nameless tour — a row nobody can find in the list', () => {
    expect(tourFormSchema.safeParse({ ...MINIMAL_DRAFT, name: '' }).success).toBe(false);
  });

  it('rejects a slug that is not kebab-case rather than silently re-slugifying it', () => {
    // A slug is a public URL. Quietly rewriting what was typed is how someone
    // ships a link that does not match the one they copied out of the form.
    for (const bad of ['Spiti Valley', 'spiti_valley', 'spiti--valley', '-spiti', 'spiti-']) {
      expect(tourFormSchema.safeParse({ ...MINIMAL_DRAFT, slug: bad }).success).toBe(false);
    }
    expect(tourFormSchema.safeParse({ ...MINIMAL_DRAFT, slug: 'spiti-valley-2' }).success).toBe(true);
  });
});

describe('the publish bar', () => {
  it('accepts a tour with a name, slug, category, destination, description, duration and price', () => {
    expect(publishableTourSchema.safeParse(PUBLISHABLE).success).toBe(true);
  });

  it('refuses to publish a tour that the draft schema happily saves', () => {
    // The whole point of two schemas: this exact object is valid to save and
    // invalid to publish.
    expect(tourFormSchema.safeParse(MINIMAL_DRAFT).success).toBe(true);
    expect(publishableTourSchema.safeParse(MINIMAL_DRAFT).success).toBe(false);
  });

  it.each([
    ['shortDescription', 'shortDescription'],
    ['durationLabel', 'durationLabel'],
    ['priceFrom', 'priceFrom'],
  ])('refuses to publish without %s, and says which field', (field, expectedPath) => {
    const result = publishableTourSchema.safeParse({ ...PUBLISHABLE, [field]: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === expectedPath)).toBe(true);
    }
  });

  it('accepts a tour priced ONLY by tiers, with no single price', () => {
    // The per-tour pricing choice, enforced: a tiered tour legitimately has no
    // `priceFrom`, and requiring one would force a fictional base price.
    const tiered: TourFormValues = {
      ...PUBLISHABLE,
      priceFrom: '',
      pricingTiers: [{ name: 'Standard', price: '₹42,500' }],
    };
    expect(publishableTourSchema.safeParse(tiered).success).toBe(true);
  });

  it('refuses to publish a tour with neither a price nor a tier', () => {
    const priceless: TourFormValues = { ...PUBLISHABLE, priceFrom: '', pricingTiers: [] };
    expect(publishableTourSchema.safeParse(priceless).success).toBe(false);
  });

  it('does NOT require images, itinerary, FAQs or a full description', () => {
    // Uploads are Phase C and are not wired to storage. Gating publish on a
    // field the system cannot yet accept would make publishing impossible.
    const bare: TourFormValues = {
      ...PUBLISHABLE,
      fullDescription: '',
      itineraryDays: [],
      faqs: [],
      inclusions: [],
      exclusions: [],
    };
    expect(publishableTourSchema.safeParse(bare).success).toBe(true);
  });

  it('does not require priceWas/savingsLabel — the fabricated-discount fields', () => {
    // Requiring these would pressure an admin into inventing a "was" price to
    // get a tour live, which is the defect `pricingUnverified` exists for.
    expect(PUBLISHABLE.priceWas).toBeUndefined();
    expect(publishableTourSchema.safeParse(PUBLISHABLE).success).toBe(true);
  });
});

describe('parseTourForm routes each intent to the right schema', () => {
  it('uses the draft schema for "draft" and the publish schema for "publish"', () => {
    expect(parseTourForm('draft', MINIMAL_DRAFT).success).toBe(true);
    expect(parseTourForm('publish', MINIMAL_DRAFT).success).toBe(false);
    expect(parseTourForm('publish', PUBLISHABLE).success).toBe(true);
  });

  it('rejects an intent that is not one of the two', () => {
    // The intent arrives in a form field, i.e. from the browser. A third value
    // must not fall through to the laxer parser.
    for (const bad of ['', 'DRAFT', 'publish ', 'admin', null, undefined, 7]) {
      expect(isSubmitIntent(bad)).toBe(false);
    }
    expect(isSubmitIntent('draft')).toBe(true);
    expect(isSubmitIntent('publish')).toBe(true);
  });
});

describe('the two categorisation axes stay in sync with the database enums', () => {
  it('CATEGORY_VALUES matches the DestinationCategory union exactly', () => {
    // `CATEGORY_TO_PRISMA` is typed `Record<DestinationCategory, …>`, so its keys
    // ARE the union. Comparing against it means adding a category to the domain
    // without adding it to the admin form's select fails here rather than
    // silently dropping an option.
    expect([...CATEGORY_VALUES].sort()).toEqual(Object.keys(CATEGORY_TO_PRISMA).sort());
  });

  it('AUDIENCE_TAG_VALUES matches the TourAudienceTag mapping exactly', () => {
    expect([...AUDIENCE_TAG_VALUES].sort()).toEqual(Object.keys(AUDIENCE_TAG_TO_PRISMA).sort());
  });

  it('round-trips every audience tag through the Prisma member name', () => {
    // The `@map`ped members are the risk: 'Group Tour' → GroupTour → 'Group Tour'.
    for (const tag of AUDIENCE_TAG_VALUES) {
      expect(toDomainAudienceTag(AUDIENCE_TAG_TO_PRISMA[tag])).toBe(tag);
    }
  });

  it('throws on an audience tag the code does not know, rather than dropping it', () => {
    // Silently dropping it would render the form with that tag unchecked, and
    // the next save would DELETE it from the row — a schema/code mismatch
    // quietly destroying data.
    expect(() => toDomainAudienceTag('Corporate')).toThrow(/Unknown TourAudienceTag "Corporate"/);
  });

  it('keeps the two axes distinct — International is in both and they do not merge', () => {
    // A tour can be thematically International or sold to an International
    // audience, and those are different claims. This asserts the overlap is
    // deliberate rather than a duplicate to be cleaned up.
    expect(CATEGORY_VALUES).toContain('International');
    expect(AUDIENCE_TAG_VALUES).toContain('International');
    expect(CATEGORY_VALUES).not.toContain('Domestic');
    expect(CATEGORY_VALUES).not.toContain('Custom-eligible');
    expect(AUDIENCE_TAG_VALUES).not.toContain('Spiritual');
  });
});

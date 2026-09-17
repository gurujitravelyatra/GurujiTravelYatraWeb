import { z } from 'zod';

/**
 * The tour editor's contract — Phase B of the admin CMS.
 *
 * Deliberately NOT `server-only`. This module is imported by the client form
 * (`TourForm.tsx`, via `@hookform/resolvers/zod`) AND re-run by the server
 * actions that persist the result, so the browser's validation and the server's
 * are literally the same object rather than two hand-kept-in-sync copies. That
 * is the same discipline `lead-form-schema.ts` uses for the public forms, and
 * the reason `build-lead-request.test.ts` can re-run the real server schema over
 * a client-built payload.
 *
 * Client-side validation here is a CONVENIENCE. The server action re-parses
 * every submission with these schemas before touching the database, because
 * anything that travelled through a browser is attacker-controlled by the time
 * it comes back — the same reasoning as the `next` field in `loginAction`.
 */

/**
 * Mirrors the `DestinationCategory` union in `src/content/types.ts`.
 *
 * Written out rather than derived from that union because Zod needs runtime
 * values and the union is a type. `tour-form-schema.test.ts` asserts the two
 * agree, so adding a category to one without the other fails a test rather than
 * silently dropping an option from the admin form's select.
 */
export const CATEGORY_VALUES = [
  'Spiritual',
  'Mountains',
  'Cultural',
  'Family',
  'Adventure',
  'International',
  'Beach',
  'Himalaya',
  'Family Trip',
  'Pilgrimage',
] as const;

/**
 * The AUDIENCE axis — see `TourAudienceTag` in `prisma/schema.prisma` for why
 * this is separate from `CATEGORY_VALUES` above and must not be merged into it.
 * These are the domain strings; `prisma-audience-tag.ts` maps them to the Prisma
 * enum member names (`Group Tour` → `GroupTour`).
 */
export const AUDIENCE_TAG_VALUES = ['Domestic', 'International', 'Group Tour', 'Custom-eligible'] as const;

export type AudienceTagValue = (typeof AUDIENCE_TAG_VALUES)[number];

/**
 * Kebab-case, the shape `slugify()` produces and the shape every existing tour
 * slug already has. Enforced rather than silently re-slugified on save: the slug
 * is a PUBLIC URL, and quietly rewriting what the admin typed is how someone
 * ships a link that does not match the one they copied out of the form.
 */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === '' ? undefined : value));

/**
 * One itinerary day. `dayNumber` is NOT collected from the form — the server
 * renumbers days contiguously from 1 in array order on every save, so the
 * database's `@@unique([tourSlug, dayNumber])` cannot be violated by a gap or a
 * duplicate the admin created by removing a row from the middle.
 */
export const itineraryDaySchema = z.object({
  title: z.string().trim().min(1, 'Give this day a title.'),
  description: z.string().trim().min(1, 'Describe what happens on this day.'),
});

export const faqSchema = z.object({
  question: z.string().trim().min(1, 'Enter the question.'),
  answer: z.string().trim().min(1, 'Enter the answer.'),
});

/**
 * One named price tier. The PRESENCE of rows is what switches a tour from single
 * price to tiered — there is no boolean (see `TourPricingTier` in the schema for
 * why a flag beside the rows would drift).
 */
export const pricingTierSchema = z.object({
  name: z.string().trim().min(1, 'Name this tier (e.g. Standard).'),
  price: z.string().trim().min(1, 'Enter this tier’s price.'),
  description: optionalText,
});

/**
 * DRAFT-LEVEL validation — what it takes to SAVE, not to publish.
 *
 * Deliberately permissive. A draft exists so work can be saved half-finished:
 * requiring a price or a description to press "Save as Draft" would mean the
 * admin either loses the work or types filler to get past the validator, and
 * filler that later gets published is worse than an empty field that cannot be.
 *
 * Only two things are required here, and both are structural rather than
 * editorial: a name (so the row is identifiable in the list) and a valid,
 * unique slug (so it has a stable address). Everything else is optional until
 * `publishableTourSchema` below.
 */
export const tourFormSchema = z.object({
  name: z.string().trim().min(2, 'Enter the tour name.'),
  slug: z
    .string()
    .trim()
    .min(1, 'Enter a slug.')
    .regex(SLUG_PATTERN, 'Use lowercase letters, numbers and single hyphens, e.g. spiti-valley-circuit.'),
  destinationSlug: z.string().trim().min(1, 'Choose a destination.'),
  category: z.enum(CATEGORY_VALUES),
  audienceTags: z.array(z.enum(AUDIENCE_TAG_VALUES)).default([]),

  durationLabel: optionalText,
  /** The route line, e.g. "Shimla - Kaza - Chandratal". Not a description. */
  subtitle: optionalText,
  shortDescription: optionalText,
  fullDescription: optionalText,
  /** Regular tours only — the form hides it when `Group Tour` is tagged. */
  bestTimeToVisit: optionalText,

  priceFrom: optionalText,
  priceWas: optionalText,
  savingsLabel: optionalText,
  seatsLabel: optionalText,
  isHot: z.boolean().default(false),

  inclusions: z.array(z.string().trim().min(1)).default([]),
  exclusions: z.array(z.string().trim().min(1)).default([]),

  itineraryDays: z.array(itineraryDaySchema).default([]),
  faqs: z.array(faqSchema).default([]),
  pricingTiers: z.array(pricingTierSchema).default([]),
});

export type TourFormValues = z.input<typeof tourFormSchema>;
export type ParsedTourFormValues = z.output<typeof tourFormSchema>;

/**
 * THE MINIMUM BAR TO PUBLISH — documented here because it is a product decision,
 * not an implementation detail.
 *
 * Publishing puts a tour in front of visitors, so the bar is "would a visitor
 * landing on this page get a coherent answer", and each requirement below is
 * something whose absence renders a visibly broken card or detail page:
 *
 *  1. **name + slug** — already required to save at all.
 *  2. **category** — drives the public filter chips; an uncategorised tour is
 *     unreachable through `/tour-packages`' own navigation.
 *  3. **destination** — a `PackageCard` renders the destination name, and
 *     `getDestinationOptions()` derives the destination filter from it.
 *  4. **a short description** — the card's only prose. Without it the catalogue
 *     shows a title and a price and nothing that explains the trip.
 *  5. **a duration label** — rendered on every card and on the detail page.
 *  6. **a price**: either `priceFrom` OR at least one pricing tier. This is the
 *     single/tiered choice expressed as validation — a tour with neither quotes
 *     no price at all, which for a sellable product is the one field that cannot
 *     be missing.
 *
 * ## What is deliberately NOT required
 *
 * **No image requirement.** Cover image, gallery and brochure uploads are Phase
 * C and are not wired to storage yet (see `TourForm`'s upload section). Gating
 * publish on a field the system cannot currently accept would make publishing
 * impossible, so a published tour renders the same token-coloured
 * `PhotoPlaceholder` the whole site already uses (Assumption A4). When uploads
 * land, whether a cover image becomes mandatory is a decision for that phase.
 *
 * **No itinerary, FAQ, inclusions or full description requirement.** The public
 * detail page renders only the fields that exist (BLOCKERS.md Decision D) and
 * omits the sections that do not, so their absence is a shorter page, not a
 * broken one.
 *
 * **No `priceWas`/`savingsLabel` requirement**, and note these two are the
 * fabricated-discount risk `pricingUnverified` exists for — requiring them would
 * pressure an admin into inventing a "was" price to get a tour live.
 */
export const publishableTourSchema = tourFormSchema.superRefine((values, ctx) => {
  if (!values.shortDescription) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['shortDescription'],
      message: 'A short description is required to publish — it is the only prose on the tour card.',
    });
  }

  if (!values.durationLabel) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['durationLabel'],
      message: 'A duration is required to publish, e.g. “6 Days 5 Nights”.',
    });
  }

  const hasTierPrice = values.pricingTiers.length > 0;
  if (!values.priceFrom && !hasTierPrice) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['priceFrom'],
      message: 'A published tour needs a price — either a single price or at least one pricing tier.',
    });
  }
});

/**
 * Which button was pressed. Two submit actions, not a status dropdown: the admin
 * is choosing an ACTION ("publish this") rather than editing a field, and a
 * dropdown would let someone set "Published" and then press a Save that runs the
 * draft-level validation, publishing a tour that never met the publish bar.
 *
 * `'draft'` ALWAYS writes `status: DRAFT`, including for an already-published
 * tour — that is the un-publish path, and it is why this is not "save".
 */
export const SUBMIT_INTENTS = ['draft', 'publish'] as const;
export type SubmitIntent = (typeof SUBMIT_INTENTS)[number];

export function isSubmitIntent(value: unknown): value is SubmitIntent {
  return typeof value === 'string' && (SUBMIT_INTENTS as readonly string[]).includes(value);
}

/**
 * Parses with the schema the intent demands. The ONE place that mapping is made,
 * so a caller cannot publish through the draft-level schema by picking the wrong
 * parser.
 */
export function parseTourForm(intent: SubmitIntent, values: unknown) {
  return intent === 'publish' ? publishableTourSchema.safeParse(values) : tourFormSchema.safeParse(values);
}

/** Auto-slug used by the form as the admin types a title. Same helper the fixtures use. */
export { slugify } from '@/content/slug';

import { z } from 'zod';

import { deriveSavingsLabel, parseRupeeAmount, RUPEE_FORMAT_MESSAGE } from '@/lib/rupees';

import { containsMarkup, MARKUP_REJECTED_MESSAGE } from './plain-text';

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
/**
 * A ceiling on slug length, added 2026-09-19.
 *
 * The pattern used to constrain the SHAPE and say nothing about the size, so
 * `'a'.repeat(5000)` satisfied it — found by the upload route's own L1 test,
 * which expected an oversized slug to be refused and watched it sail through.
 *
 * Two things cared. A slug is the public URL, and browsers and proxies have
 * their own (undocumented, varying) limits well below this — so a 5 kB slug is
 * a tour nobody can reach. And it reaches `folderFor()` in the upload path,
 * where it becomes a Cloudinary folder name; the pattern stops it being a path
 * traversal and did not stop it being enormous.
 *
 * 100 is roughly three times the longest real slug in the catalogue
 * (`leh-ladakh-group-trip-from-delhi`, 32 characters), so it constrains nothing
 * anyone would legitimately type.
 */
export const MAX_SLUG_LENGTH = 100;

/**
 * The cap lives INSIDE the pattern (the lookahead), not only beside it as a
 * separate `.max()`. A consumer that imports `SLUG_PATTERN` and forgets
 * `MAX_SLUG_LENGTH` — which is exactly what the upload route did the first time
 * — therefore still gets the length rule. One constant, both halves of the rule.
 * The schema below keeps its own `.max()` purely for the better error message.
 */
export const SLUG_PATTERN = new RegExp(`^(?=.{1,${MAX_SLUG_LENGTH}}$)[a-z0-9]+(?:-[a-z0-9]+)*$`);

/**
 * PLAIN TEXT — the stored-XSS rule, Phase D.
 *
 * Wraps a string rule so it also refuses anything an HTML parser could open a tag
 * on. Applied to every free-text field below and to nothing else; the full
 * reasoning, including why this REFUSES rather than silently strips and why the
 * real stripping lives server-side in `sanitize-tour-text.ts`, is in
 * `plain-text.ts`.
 *
 * Takes the built `ZodString` rather than appending to it, because `.refine()`
 * returns a `ZodEffects` that no longer carries `.min()`/`.regex()` — so the
 * length rules must be attached first and this must be the outermost call. That
 * ordering is also the one that produces the better error: a field whose entire
 * contents were a tag reports "remove the HTML tags", not "too short".
 */
function plainText<T extends z.ZodString>(rule: T) {
  return rule.refine((value) => !containsMarkup(value), MARKUP_REJECTED_MESSAGE);
}

const optionalText = plainText(z.string().trim())
  .optional()
  .transform((value) => (value === '' ? undefined : value));

/** An optional price in the canonical `₹42,500` form — M6. Empty means "not set". */
const rupeeAmount = optionalText.refine(
  (value) => value === undefined || parseRupeeAmount(value) !== undefined,
  RUPEE_FORMAT_MESSAGE
);

/**
 * One itinerary day. `dayNumber` is NOT collected from the form — the server
 * renumbers days contiguously from 1 in array order on every save, so the
 * database's `@@unique([tourSlug, dayNumber])` cannot be violated by a gap or a
 * duplicate the admin created by removing a row from the middle.
 */
export const itineraryDaySchema = z.object({
  title: plainText(z.string().trim().min(1, 'Give this day a title.')),
  description: plainText(z.string().trim().min(1, 'Describe what happens on this day.')),
});

export const faqSchema = z.object({
  question: plainText(z.string().trim().min(1, 'Enter the question.')),
  answer: plainText(z.string().trim().min(1, 'Enter the answer.')),
});

/**
 * A Cloudinary delivery URL, and nothing else — Phase C.
 *
 * ## Why the host is pinned instead of accepting any `https://` URL
 *
 * These values travel through the browser. The tour form serialises them into
 * the hidden `payload` field and the server action re-parses them, which means
 * `coverImageUrl` is attacker-controlled in exactly the way this module's header
 * note says every field is — a hand-crafted POST can put any string here, and
 * `/api/admin/uploads` is not the only way one arrives.
 *
 * A bare `z.string().url()` would therefore let a signed-in admin (or anyone who
 * got hold of a session) point a published tour's cover at any host on the
 * internet. That is a real, if modest, hole: the public page would hotlink an
 * asset this project does not control, which can be swapped for anything after
 * review, and every visitor's browser would make a request to a third party from
 * a page carrying our domain.
 *
 * Pinning the host closes it for the cost of one `startsWith`, and costs nothing
 * legitimate — the only supported way to get a URL into these fields is to upload
 * a file, and every upload returns a `res.cloudinary.com` URL.
 *
 * It also rejects, for free, the scheme games a URL field attracts
 * (`javascript:`, `data:`), because neither can satisfy the prefix.
 */
export const CLOUDINARY_URL_PREFIX = 'https://res.cloudinary.com/';

const cloudinaryUrl = z
  .string()
  .trim()
  .url('That is not a valid image address.')
  .startsWith(CLOUDINARY_URL_PREFIX, 'Images must be uploaded through this form, not linked from elsewhere.');

/**
 * One uploaded gallery image. Mirrors `TourGalleryImage` minus its ordering
 * column, which is DERIVED from array position on save exactly as itinerary day
 * numbers are — see `childCreates()`.
 *
 * `url` and `publicId` travel together as one object rather than as two parallel
 * arrays for the reason the schema's own note gives: nothing would keep index `n`
 * of one aligned with index `n` of the other.
 */
export const galleryImageSchema = z.object({
  url: cloudinaryUrl,
  publicId: z.string().trim().min(1),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export type GalleryImageValue = z.infer<typeof galleryImageSchema>;

/**
 * The brochure PDF, as the form carries it.
 *
 * All four fields or none — which is why this is a nested object rather than four
 * optional siblings. A `brochurePdfUrl` with no `brochurePdfPublicId` is not a
 * partially-filled brochure, it is a corrupt one, and the object shape makes that
 * unrepresentable instead of something the persistence layer has to check for.
 *
 * Note where this ends up: the `Brochure` table, NOT a column on `Tour`. See the
 * note on `Brochure.pdfUrl` in `prisma/schema.prisma` for why a
 * `Tour.brochurePdfUrl` would have made `GET /api/brochures/[slug]` lie.
 */
export const brochureFileSchema = z.object({
  url: cloudinaryUrl,
  publicId: z.string().trim().min(1),
  /** The admin's own filename, shown back to them so they can confirm the right file. */
  fileName: z.string().trim().min(1),
  sizeBytes: z.number().int().nonnegative(),
});

export type BrochureFileValue = z.infer<typeof brochureFileSchema>;

/**
 * One named price tier. The PRESENCE of rows is what switches a tour from single
 * price to tiered — there is no boolean (see `TourPricingTier` in the schema for
 * why a flag beside the rows would drift).
 */
export const pricingTierSchema = z.object({
  name: plainText(z.string().trim().min(1, 'Name this tier (e.g. Standard).')),
  price: plainText(z.string().trim().min(1, 'Enter this tier’s price.')),
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
const tourFormObject = z.object({
  name: plainText(z.string().trim().min(2, 'Enter the tour name.')),
  slug: z
    .string()
    .trim()
    .min(1, 'Enter a slug.')
    .max(MAX_SLUG_LENGTH, `A slug may be at most ${MAX_SLUG_LENGTH} characters.`)
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

  /**
   * M6 — both prices must be in the canonical written form (`₹42,500`), because
   * they are rendered verbatim AND read as numbers by `getPriceRange()`. See
   * `src/lib/rupees.ts`.
   */
  priceFrom: rupeeAmount,
  priceWas: rupeeAmount,
  /**
   * ACCEPTED BUT IGNORED on input, and DERIVED on output — see the transform at
   * the end of this schema. Kept in the input shape (rather than removed) so a
   * stale browser tab or an old test payload that still sends it parses, and so
   * markup in it is still refused like every other text field.
   */
  savingsLabel: optionalText,
  seatsLabel: optionalText,
  isHot: z.boolean().default(false),

  inclusions: z.array(plainText(z.string().trim().min(1))).default([]),
  exclusions: z.array(plainText(z.string().trim().min(1))).default([]),

  itineraryDays: z.array(itineraryDaySchema).default([]),
  faqs: z.array(faqSchema).default([]),
  pricingTiers: z.array(pricingTierSchema).default([]),

  /**
   * MEDIA — Phase C. Optional at the draft level like everything else here, so a
   * half-finished tour can be saved before anyone has found the photos.
   *
   * `coverImage` becomes REQUIRED at the publish level below — the one media
   * field that does.
   */
  coverImage: z
    .object({ url: cloudinaryUrl, publicId: z.string().trim().min(1) })
    .optional(),
  galleryImages: z.array(galleryImageSchema).default([]),
  brochureFile: brochureFileSchema.optional(),
});

/**
 * The draft-level schema: the object above, plus the two price rules that span
 * fields (M6).
 *
 * 1. A "was" price needs a current price beside it, and must be HIGHER than it.
 *    `priceWas` renders as a strikethrough next to `priceFrom`; a "was" price at
 *    or below today's is a claimed discount that is not one.
 * 2. `savingsLabel` is DERIVED from the two prices, and whatever arrived in the
 *    field is discarded. It used to be typed by hand, so "was ₹47,700, now
 *    ₹42,500, save ₹8,000" was one keystroke away and nothing checked the
 *    arithmetic. It is derived from the two FORM fields the admin just
 *    submitted — not from anything the form does not show — so this is not the
 *    save-time side effect `photosCount` taught us to avoid: an unrelated edit
 *    cannot change it, only an edit to the prices it is computed from. Every
 *    seeded tour's stored savings already equals was − from (checked when this
 *    was written), so re-saving one changes nothing.
 */
export const tourFormSchema = tourFormObject
  .superRefine((values, ctx) => {
    if (!values.priceWas) return;

    const from = values.priceFrom ? parseRupeeAmount(values.priceFrom) : undefined;
    const was = parseRupeeAmount(values.priceWas);
    // A non-canonical value already has its own format error; do not stack a
    // second, confusing one on top.
    if (was === undefined) return;
    if (values.priceFrom && from === undefined) return;

    if (from === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['priceWas'],
        message: 'A “was” price needs a current price beside it. Fill in the price, or clear this field.',
      });
      return;
    }

    if (was <= from) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['priceWas'],
        message: 'The “was” price must be higher than the current price — otherwise there is no saving to show.',
      });
    }
  })
  .transform((values): typeof values => ({
    ...values,
    savingsLabel: deriveSavingsLabel(values.priceFrom, values.priceWas),
  }));

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
 *  7. **a cover image** — NEW IN PHASE C, and a reversal of Phase B's rule.
 *
 * ## The cover-image requirement, and why it was absent until now
 *
 * The user's original specification said "Cover image (single, required)". Phase
 * B did not enforce it, and recorded why: uploads did not exist, so requiring a
 * cover would have made publishing impossible rather than making it better. That
 * was an interim decision with a stated expiry — "when uploads land, whether a
 * cover image becomes mandatory is a decision for that phase" — and this is that
 * phase.
 *
 * Uploads now work, so the original requirement is enforced as written. Note the
 * asymmetry that makes this safe: it is required to PUBLISH, not to SAVE. A draft
 * with no cover still saves, which is the whole point of drafts, and an existing
 * PUBLISHED tour is not retroactively invalidated — nothing re-validates stored
 * rows, so the 22 live fixture tours are untouched until someone edits and
 * re-publishes one. Making it a NOT NULL column would have done the opposite.
 *
 * ## What is deliberately NOT required
 *
 * **Gallery images and the brochure PDF stay optional.** The original spec marked
 * only the cover image required, and that reading is kept literally. A tour with
 * one good cover photo and no gallery renders a complete card and a complete
 * detail page; the detail page's gallery section is simply absent, which is
 * Decision D's rule (render what exists) and not a broken layout. Requiring a
 * brochure would be worse than cosmetic — no brochure PDF exists for any tour in
 * this project, so it would block publishing outright, which is exactly the
 * mistake this requirement's own history warns about.
 *
 * **No itinerary, FAQ, inclusions or full description requirement.** The public
 * detail page renders only the fields that exist (BLOCKERS.md Decision D) and
 * omits the sections that do not, so their absence is a shorter page, not a
 * broken one.
 *
 * **No `priceWas`/`savingsLabel` requirement**, and note these two are the
 * fabricated-discount risk `pricingUnverified` exists for — requiring them would
 * pressure an admin into inventing a "was" price to get a tour live. (As of M6
 * `savingsLabel` cannot be typed at all — it is derived from the two prices.)
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

  /**
   * The cover image. Phase C — see the block comment above for why this was
   * absent in Phase B and is enforced now.
   *
   * The `path` is `coverImage` and not `coverImage.url`, because the form renders
   * one error slot for the whole upload control; pointing at the nested field
   * would address a slot that does not exist and the message would vanish.
   */
  if (!values.coverImage) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['coverImage'],
      message: 'A cover image is required to publish — it is the photo on the tour card and at the top of the tour page.',
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

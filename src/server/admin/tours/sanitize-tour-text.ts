import 'server-only';
import sanitizeHtml from 'sanitize-html';
import { decodeHTML } from 'entities';

import { containsMarkup } from './plain-text';
import type { ParsedTourFormValues } from './tour-form-schema';

/**
 * Write-time markup stripping for admin-authored tour copy — Phase D.
 *
 * This is the second half of the plain-text rule; `plain-text.ts` holds the first
 * half and the reasoning for the split. Short version: that file REFUSES markup
 * at validation time with a message the admin can act on, this file STRIPS it on
 * the way to the database so the guarantee does not depend on any validator
 * having run.
 *
 * ## Is there actually a hole this closes?
 *
 * Not at render time today, and it is worth being precise rather than alarming
 * about it. Every public surface in this project renders tour text as JSX text
 * children, React escapes those, and React's raw-HTML escape hatch appears
 * NOWHERE in `src/` — audited, and now asserted by `no-raw-html-render.test.ts`
 * so it stays that way. (That test greps for the identifier, which is why this
 * note does not spell it out.) A stored `<script>` tag today therefore reaches a
 * visitor as the visible characters `<script>`: ugly, and not an execution.
 *
 * What this file protects is the FUTURE of that sentence. The properties it is
 * buying:
 *
 *  1. **The stored row is clean regardless of who reads it.** `/api/tours` and
 *     `/api/tours/[slug]` already publish this text as JSON to clients this repo
 *     does not own and cannot audit. React's escaping protects our pages; it
 *     protects nothing on the other side of an HTTP boundary.
 *  2. **A later render change cannot silently reintroduce the hole.** The public
 *     detail page renders a deliberately narrow field set today (BLOCKERS.md
 *     Decision D) — no itinerary, no FAQs, no full description. Those fields are
 *     collected and stored anyway, so the day someone builds the richer detail
 *     page, the text they render was written under the old rules. Cleaning at
 *     write time means the archive is already safe when that happens; cleaning at
 *     render time means remembering to, in a file that does not exist yet.
 *  3. **It holds for write paths that never touch the Zod schema.** A future
 *     import script, a bulk edit, a fixture load — anything that calls
 *     `createTour`/`updateTour` gets this, because it lives in the repository and
 *     not in the validator.
 *
 * ## The guard clause is load-bearing, and lossless by construction
 *
 * `toPlainText` returns the input UNTOUCHED when `containsMarkup()` is false, and
 * only then runs the parser. That is not an optimisation — it is what makes this
 * function safe to apply unconditionally to every field on every save.
 *
 * The reason it is needed: `sanitize-html` emits HTML SOURCE, not text. It escapes
 * what it passes through, so `Tea & coffee` comes back as `Tea &amp; coffee`, and
 * storing that would put the literal characters `&amp;` on the tour page — React
 * escapes the `&` again on render. Undoing that with `decodeHTML` is correct for
 * the round trip, but a round trip through an HTML parser is not the identity for
 * text: an admin who typed the literal characters `&amp;amp;` gets `&amp;` back,
 * because the parser reads their text as HTML and resolves one level of entity.
 *
 * Applying the round trip only when there IS markup means:
 *
 *  - every value the form's own validation accepts (markup-free, by definition)
 *    is stored byte-for-byte as the admin typed it — no escaping artefacts, no
 *    entity resolution, no collapsed whitespace;
 *  - a value carrying markup goes through a real HTML parser, which is the only
 *    thing that should be trusted to take markup apart.
 *
 * The guard is sound in the direction that matters. `containsMarkup()` is false
 * only when the string has no `<` followed by an ASCII letter, `/`, `!` or `?` —
 * and those four are exhaustively the transitions out of the HTML tokenizer's
 * tag-open state. Any other character after `<` makes the parser emit `<` as a
 * literal. So "no markup detected" means "no HTML parser can build an element
 * from this", and returning it unchanged is not a shortcut, it is the answer.
 *
 * ## Why `sanitize-html` and not a regex
 *
 * Because `<scr<script>ipt>alert(1)</script>` is a real payload and the obvious
 * regex turns it into a working one. Taking markup apart is a parser's job;
 * the test file runs that exact input, among others.
 */

/**
 * Strip EVERYTHING. No allowed tags, no allowed attributes, no allowed schemes.
 *
 * `allowedTags: []` with the default `disallowedTagsMode: 'discard'` drops each
 * tag and keeps its text content — so `<b>Deluxe</b>` becomes `Deluxe` rather
 * than disappearing. The exception is `nonTextTags` (`script`, `style`,
 * `textarea`, `option`), whose CONTENT is dropped too, which is what turns
 * `<script>alert(1)</script>` into an empty string instead of `alert(1)`.
 *
 * There is no "allow bold and italics" variant of this config and there should
 * not be one: every one of these fields is rendered as a JSX text child, so a
 * `<b>` that survived here would reach a visitor as the visible characters
 * `<b>`. Allowing a tag would only be meaningful alongside a renderer that
 * interprets it, and adding that renderer is the change that must re-open this
 * file — not something to have pre-authorised.
 */
const STRIP_ALL: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
};

/**
 * Admin-authored text → the same text with any HTML markup removed.
 *
 * Idempotent: the output contains no markup, so `containsMarkup()` is false for
 * it and a second application returns it unchanged. That matters because this is
 * applied on every save, including saves of a tour that was loaded from the
 * database and re-submitted untouched — a non-idempotent transform would erode
 * the text a little further each time the admin pressed Save.
 */
export function toPlainText(value: string): string {
  if (!containsMarkup(value)) return value;

  /**
   * ## Why this is a LOOP now, and not one round trip
   *
   * One round trip is not a fixed point, and the counterexample is not exotic:
   *
   *   `<p>&amp;lt;script&gt;</p>`
   *
   * The parser reads the `<p>`'s text content as `&lt;script>` (it resolved
   * `&amp;` → `&`), `sanitize-html` re-escapes that for output, and `decodeHTML`
   * undoes the escaping — leaving `&lt;script>` stored. So a single pass took an
   * input that WAS detected as markup and turned it into an entity-encoded
   * payload that the old detector would then have called clean. The round trip
   * manufactured the very thing this file exists to remove.
   *
   * Entity decoding is not idempotent on text that contains encoded entities,
   * and a parser round trip performs one level of it. The fix is to keep going
   * while the result still looks like markup, which converges quickly because
   * each pass strips one encoding layer:
   *
   *   `<p>&amp;lt;script&gt;</p>` → `&lt;script>` → `<script>` → `` (empty)
   *
   * Empty is the correct destination for that input — `script` is a
   * `nonTextTag`, so its content is dropped, exactly as a literal
   * `<script>alert(1)</script>` has always been dropped here.
   *
   * ## The loop cannot erode legitimate text
   *
   * It is entered only when `containsMarkup()` is true, and it exits the moment
   * `containsMarkup()` goes false — so `<b>Deluxe</b>` runs exactly one pass and
   * stops at `Deluxe`, and `Tea &amp; coffee` never enters at all (the guard
   * clause above returns it byte-for-byte, which is the property this whole file
   * is built around). The cap is a backstop for a pathological input rather than
   * an expected exit; an input that is still markup after five passes has been
   * whittled to something no browser would build an element from anyway.
   */
  let current = value;

  for (let round = 0; round < MAX_STRIP_ROUNDS; round += 1) {
    const stripped = decodeHTML(sanitizeHtml(current, STRIP_ALL));

    // A genuine fixed point. Further passes would only re-escape and re-decode
    // the same string forever.
    if (stripped === current) return current;

    current = stripped;
    if (!containsMarkup(current)) return current;
  }

  return current;
}

/**
 * Matches `MAX_DECODE_ROUNDS` in `plain-text.ts` and for the same reason: each
 * pass peels one encoding layer, real payloads use one or two, and the bound is
 * what stops a hand-crafted input choosing how long a save takes.
 */
const MAX_STRIP_ROUNDS = 5;

/** `toPlainText` over an optional field, preserving `undefined`. */
function optional(value: string | undefined): string | undefined {
  return value === undefined ? undefined : toPlainText(value);
}

/**
 * Every free-text field on a tour, cleaned. Listed EXPLICITLY, field by field,
 * rather than walked generically over the object.
 *
 * A generic deep walk would be shorter and would be wrong in both directions. It
 * would reach fields that must not be rewritten — `slug` is a public URL,
 * `coverImage.url` is a host-pinned Cloudinary address, `publicId` is an
 * identifier Cloudinary issued — and, because it silently covers whatever the
 * type happens to contain, it would also cover a future field that needs
 * different handling without anyone deciding that it should. The explicit list
 * means adding a field to `tourFormSchema` and forgetting it here is a visible
 * omission in one file rather than an invisible default.
 *
 * ## What is deliberately NOT sanitized, and why each is already safe
 *
 *  - `slug` — `SLUG_PATTERN` admits only `[a-z0-9-]`, so it cannot carry markup.
 *    It is also the public URL, and rewriting it here would produce an address
 *    the admin did not choose (`tour-form-schema.ts` records that argument).
 *  - `category`, `audienceTags` — `z.enum`. Not free text at all.
 *  - `destinationSlug` — a foreign key to `Destination.slug`. A value that is not
 *    a real destination is refused by the database, not by a text filter.
 *  - `coverImage.url`, `galleryImages[].url`, `brochureFile.url` — pinned to the
 *    `https://res.cloudinary.com/` prefix, which already excludes `javascript:`
 *    and `data:` (see `CLOUDINARY_URL_PREFIX`). Stripping "markup" from a URL
 *    could only corrupt a legitimate one.
 *  - `publicId`, `width`, `height`, `sizeBytes`, `isHot` — identifiers and
 *    non-strings; none is rendered as prose.
 *
 * `brochureFile.fileName` IS sanitized: it is the one media field that is a
 * human-supplied string rendered back as text, in the editor's file row today
 * and available to any future download UI.
 */
export function sanitizeTourFormValues(values: ParsedTourFormValues): ParsedTourFormValues {
  return {
    ...values,

    name: toPlainText(values.name),
    durationLabel: optional(values.durationLabel),
    subtitle: optional(values.subtitle),
    shortDescription: optional(values.shortDescription),
    fullDescription: optional(values.fullDescription),
    bestTimeToVisit: optional(values.bestTimeToVisit),

    priceFrom: optional(values.priceFrom),
    priceWas: optional(values.priceWas),
    savingsLabel: optional(values.savingsLabel),
    seatsLabel: optional(values.seatsLabel),

    inclusions: values.inclusions.map(toPlainText),
    exclusions: values.exclusions.map(toPlainText),

    itineraryDays: values.itineraryDays.map((day) => ({
      title: toPlainText(day.title),
      description: toPlainText(day.description),
    })),
    faqs: values.faqs.map((faq) => ({
      question: toPlainText(faq.question),
      answer: toPlainText(faq.answer),
    })),
    pricingTiers: values.pricingTiers.map((tier) => ({
      name: toPlainText(tier.name),
      price: toPlainText(tier.price),
      description: optional(tier.description),
    })),

    brochureFile: values.brochureFile
      ? { ...values.brochureFile, fileName: toPlainText(values.brochureFile.fileName) }
      : undefined,
  };
}

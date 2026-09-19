/**
 * The plain-text rule for admin-authored tour copy — Phase D.
 *
 * ## The two halves, and why they are two files
 *
 * Stored-XSS defence here is deliberately layered, and the layers live apart
 * because one of them must run in the browser and the other must not:
 *
 *  1. **THIS FILE — refuse markup at validation time.** Zero dependencies, so
 *     `tour-form-schema.ts` can keep being the single schema that the client form
 *     and the server action both run (see that file's header). The admin gets a
 *     field-level error the moment they paste a tag, on the same screen, rather
 *     than having their text silently rewritten underneath them.
 *  2. **`sanitize-tour-text.ts` — strip markup at write time.** `sanitize-html`,
 *     server-only, run inside `createTour`/`updateTour`. That is the structural
 *     guarantee: whatever reaches the database has no markup in it, whether or not
 *     it came through this schema.
 *
 * `sanitize-html` cannot live in half 1. It pulls `htmlparser2`, `dom-serializer`
 * and `postcss` behind it, and `tour-form-schema.ts` is imported by `TourForm.tsx`
 * — so putting it there would ship a couple of hundred kilobytes of HTML parser to
 * an admin's browser to check text the server re-checks anyway.
 *
 * ## Why REFUSE here rather than silently strip here
 *
 * The same reasoning `SLUG_PATTERN` records one file over: quietly rewriting what
 * the admin typed is how someone ships copy that is not the copy they wrote. An
 * admin who pastes `<b>Deluxe</b>` out of a Word document should be told the field
 * is plain text, not watch the word "Deluxe" appear with the emphasis missing and
 * no explanation. And an admin whose entire itinerary-day title was a `<script>`
 * tag gets "Give this day a title" — which is the truth — instead of a silently
 * empty row, because the refusal happens BEFORE `.min(1)` rather than after it.
 *
 * ## What this pattern is, and what it is NOT
 *
 * It is NOT a sanitizer and must never be treated as one. It is a conservative
 * refusal: "this string contains something that could open an HTML tag". It errs
 * toward rejecting — the only cost of a false positive is an admin rewording a
 * sentence — and the security property does not rest on it. If this regex were
 * deleted tomorrow, the stored data would still be markup-free, because
 * `sanitizeTourFormValues()` runs on the write path and it is a real parser.
 *
 * The character class is what makes the common innocent cases pass:
 *
 *   - `Rooms for < 4 guests`  → `<` followed by a space. Accepted.
 *   - `Groups of <12 people`  → `<` followed by a digit. Accepted.
 *   - `Best value <> compare` → `<` followed by `>`. Accepted.
 *   - `<script>`, `</b>`, `<!--`, `<?xml`, `<img …` → rejected.
 *
 * Only a letter, `/`, `!` or `?` can begin something an HTML parser will treat as
 * a tag, comment or processing instruction, so those four are the whole class.
 */

/**
 * A `<` that an HTML parser could read as the start of a tag, an end tag, a
 * comment/doctype (`<!`) or a processing instruction (`<?`).
 *
 * Not exported as a shared mutable regex with the `g` flag — a global regex
 * carries `lastIndex` between `.test()` calls and would return alternating
 * results for the same input, which is a genuinely horrible bug to find.
 */
const MARKUP_OPENER = /<[a-zA-Z!/?]/;

/** True when the value contains something an HTML parser could open a tag on. */
export function containsMarkup(value: string): boolean {
  return MARKUP_OPENER.test(value);
}

/**
 * The message every free-text field shows. One constant, so the twenty-odd fields
 * that use it cannot drift into twenty slightly different sentences, and so a test
 * can assert on it without transcribing it.
 *
 * It names the fix rather than the rule — "remove the tags" is actionable;
 * "invalid input" is not.
 */
export const MARKUP_REJECTED_MESSAGE =
  'Remove the HTML tags from this text. Tour copy is plain text — anything in angle brackets is not formatting and will not be saved.';

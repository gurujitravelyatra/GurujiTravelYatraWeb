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

/**
 * ## The hole this used to have: `&lt;img src=x onerror=alert(1)&gt;`
 *
 * `MARKUP_OPENER` looks for a literal `<`. An entity-encoded payload has none,
 * so the check returned false, `toPlainText`'s guard clause returned the string
 * untouched, and the row was stored verbatim. On our own pages that is inert —
 * React escapes the `&` and a visitor sees the characters. But `/api/tours`
 * publishes this text as JSON to clients this repository does not own, and the
 * first consumer to assign it to `innerHTML` decodes the entities and executes
 * the payload. The layer whose entire job is "the stored row is clean regardless
 * of who reads it" was passing through the one encoding that only matters to
 * someone else's renderer.
 *
 * `&#60;script&#62;` and the double-encoded `&amp;lt;script&amp;gt;` are the
 * same defect in two more spellings — which is why the check DECODES rather
 * than pattern-matching a list of spellings.
 *
 * ## Why a local decoder rather than the `entities` package
 *
 * This file's zero-dependency rule is load-bearing: `tour-form-schema.ts`
 * imports it and ships to the browser (see the header). Pulling a full entity
 * table in to answer a yes/no question would cost the admin's page weight for
 * a check the server repeats anyway.
 *
 * So the table below is exactly the characters that can BE a markup opener
 * (`<`, and the `/!?` that can follow it) plus the ones needed to peel a
 * multiply-encoded string apart (`&`, `#`, `;`). Letters are not named
 * entities, and numeric references cover every character, so this is not a
 * shortcut — it is the closure of the question being asked.
 *
 * It stays a CONSERVATIVE DETECTOR and not a sanitizer, exactly as before. The
 * guarantee still lives in `sanitize-tour-text.ts`, which runs a real parser
 * AND a real entity decoder on the write path and now iterates until the result
 * is stable.
 */
const DETECTABLE_ENTITIES: Record<string, string> = {
  lt: '<',
  LT: '<',
  gt: '>',
  GT: '>',
  amp: '&',
  AMP: '&',
  quot: '"',
  QUOT: '"',
  apos: "'",
  sol: '/',
  excl: '!',
  quest: '?',
  num: '#',
  semi: ';',
};

/**
 * Longest name first. HTML's tokenizer takes the LONGEST match in its table,
 * and several of these (`lt`, `gt`, `amp`, `quot`) are legacy references that
 * a browser resolves even with no trailing semicolon — so `&ltscript` really is
 * `<script` to a browser, and a detector that required the `;` would miss it.
 */
const ENTITY_NAMES_LONGEST_FIRST = Object.keys(DETECTABLE_ENTITIES).sort(
  (a, b) => b.length - a.length
);

const ENTITY_REFERENCE = /&(#[xX][0-9a-fA-F]{1,6};?|#[0-9]{1,7};?|[a-zA-Z][a-zA-Z0-9]{0,31};?)/g;

function decodeOnce(value: string): string {
  return value.replace(ENTITY_REFERENCE, (match, body: string) => {
    const hasSemicolon = body.endsWith(';');
    const name = hasSemicolon ? body.slice(0, -1) : body;

    if (name.startsWith('#')) {
      const isHex = name[1] === 'x' || name[1] === 'X';
      const code = Number.parseInt(isHex ? name.slice(2) : name.slice(1), isHex ? 16 : 10);
      // Surrogates and out-of-range values throw from `fromCodePoint`; leaving
      // the text alone is right for them — they cannot be a markup opener.
      if (!Number.isInteger(code) || code < 1 || code > 0x10ffff) return match;
      if (code >= 0xd800 && code <= 0xdfff) return match;
      return String.fromCodePoint(code);
    }

    const exact = DETECTABLE_ENTITIES[name];
    if (exact !== undefined) return exact;

    for (const candidate of ENTITY_NAMES_LONGEST_FIRST) {
      if (name.startsWith(candidate)) {
        return DETECTABLE_ENTITIES[candidate] + name.slice(candidate.length) + (hasSemicolon ? ';' : '');
      }
    }

    // Not a reference this detector knows. Left verbatim — an unknown named
    // entity cannot produce `<` here, and rewriting it would be the silent
    // corruption this whole module refuses to do.
    return match;
  });
}

/**
 * Peels entity encodings off until the string stops changing.
 *
 * ONE pass is not enough: `&amp;lt;script&amp;gt;` decodes to `&lt;script&gt;`,
 * which a single-pass detector reports as clean. Repeating catches it — and the
 * cap keeps a pathological input (a long run of `&amp;amp;amp;…`) from turning
 * a validation call into a loop an attacker controls the length of. Five rounds
 * is far past any encoding a real payload uses and is bounded regardless.
 *
 * Exported for the tests, which assert on the decoded form directly rather than
 * only on the boolean — a `false` from `containsMarkup` is indistinguishable
 * between "decoded and found nothing" and "decoded nothing at all".
 */
export const MARKUP_DECODE_ROUNDS_FOR_TESTS = 5;

export function decodeForMarkupDetection(value: string): string {
  let current = value;
  for (let round = 0; round < MARKUP_DECODE_ROUNDS_FOR_TESTS; round += 1) {
    const next = decodeOnce(current);
    if (next === current) return current;
    current = next;
  }
  return current;
}

/**
 * True when the value contains something an HTML parser could open a tag on —
 * literally, or after any number of layers of entity encoding.
 *
 * The literal test runs FIRST and short-circuits, so the overwhelmingly common
 * case (ordinary prose, no `&` in it at all) still costs one regex.
 */
export function containsMarkup(value: string): boolean {
  if (MARKUP_OPENER.test(value)) return true;
  return MARKUP_OPENER.test(decodeForMarkupDetection(value));
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
  'Remove the HTML tags from this text. Tour copy is plain text — anything in angle brackets is not ' +
  'formatting and will not be saved. This includes escaped tags such as &lt;b&gt; and &#60;b&#62;, which ' +
  'are the same tag written differently.';

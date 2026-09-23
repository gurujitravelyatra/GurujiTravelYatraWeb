---
name: QG pattern — safety flags that nothing reads
description: Recurring finding: an agent marks unsafe data with a flag/TODO and ships it rendering normally. Inject when any agent flags data as unverified.
type: feedback
---

Pattern: asked not to guess at unconfirmed data, agents do the right first half — add a field like `pricingUnverified`, a `TODO(confirm)` comment, a doc block explaining the risk — and then never write the consumer that acts on it. The flag reads as a fix in review and in the diff, but at runtime the unsafe record renders exactly like a confirmed one. Documentation is mistaken for enforcement.

Occurrences: 5
Last seen: 2026-09-19 (fixed `71acf70`)
Affected agents: frontend, backend, func-to-tech-spec
Pipeline: SPEC (GTY website)

**Occurrence 5 (review finding H1) — the flag was ENFORCED, but invisible to the
one person whose job is to notice.** `isPubliclyListable()` withheld the 3
`pricingUnverified` tours correctly; the ADMIN list still showed a green
"Published" pill, a "View on site" link to a 404, and "now visible on the public
site" after saving. The grep tell-tale below gave a false all-clear, because a
real consumer existed. Fix: `publicWithholdReason()` is THE gate and the admin
derives every claim from it. New tell-tale: **for every surface that REPORTS
state (admin, dashboards, emails), ask whether it reads the gate or a
flattening of it.**

Examples:
- [RESOLVED `14c6a65`] `Package.pricingUnverified` was set on 3 tours, documented in the type, in the fixture, and asserted by a test that only checked *the flag was still set* — while those tours rendered full "was ₹X / Save ₹Y" discount badges on 3 of 5 Home cards. Fixed by enforcing at the content-query level (`public-listing.ts`), so no listing can return a flagged record and the detail route 404s, with a test asserting no flagged record appears in ANY public listing result.
- [RESOLVED `617f8d8`] Related shape: `Review.isPlaceholder` WAS enforced (dashed border + "Placeholder" pill), but the same class of unconfirmed content in `stats.fixture.ts` had no flag at all and rendered as settled fact — including "98% Traveller Satisfaction" with no review data behind it.

- [RESOLVED `edc328f`] Third variant — enforcement that stops at the pixel. `isPlaceholder` DID render an asterisk on all three stats surfaces, so it looked enforced. But `WhyGtyBand` marked its asterisk `aria-hidden` while giving the footnote no `id`, and `Hero` had neither an `id` nor an `aria-describedby`: for a screen-reader user the marker was suppressed AND the explanation was never associated, so an unconfirmed figure read as settled fact — strictly worse than no marker. `StatsBar`'s pairing was itself only correct on paper: `aria-describedby` sat on a bare `<div>` with no role, which assistive tech routinely ignores.

- [RESOLVED `af92be2`] Fourth variant, and the first where the enforcement
  itself is correct: the gate is scoped to one fixture while a sibling fixture holds
  the same entity. `public-listing.ts` withholds "Do Dham Yatra" (₹28,900,
  `pricingUnverified`) from Home and `/tour-packages`, and 404s its detail route — but
  `group-departures.fixture.ts` transcribes the same tour from a different part of the
  export, carries the same ₹28,900, and `/group-tours` (built later) renders it as the
  card's most prominent figure. The gate only knows about `Package`, so the new surface
  bypassed it. Tellingly, the *duration* conflict for this same record WAS carried across
  (`durationUnverified`); the price was not. Fixed with `GroupDeparture.priceUnverified`
  + the marker/footnote treatment (user chose marking over withholding: no fabricated
  discount badge on that card), plus a fixture cross-check test asserting the two
  fixtures flag the same tours with the same price string — the flags can no longer
  drift apart in either direction. The fix also caught a variant-3 relapse one line
  away: the existing `durationUnverified` marker had its `aria-describedby` on an
  unroled `<span>`.

**Fifth opportunity, NOT an occurrence (`e6d2779`, 2026-09-14) — a new shape worth
naming: moving flagged data to a new STORAGE layer.** Porting content to Postgres
is the textbook moment a flag decays into an inert column: the schema carries
`pricingUnverified`, the diff looks faithful, and the gate — written against
fixture arrays — silently does not follow. Handled by making the DB adapter end
every public query in the *same* `isPubliclyListable()` predicate the fixture path
uses (the SQL `where` is only an optimisation), and by a test that returns a
flagged row from the mock **in spite of** the `where` clause and asserts the
adapter still withholds it. Generalisation: when data crosses into a new store,
port the ENFORCEMENT, not just the field — and test the gate with a query that
deliberately fails to filter, or you are only testing the `where` clause.

**SIXTH opportunity, NOT an occurrence (Phase B tour CMS, 2026-09-18) — the
highest-stakes shape so far, and the one to copy.** `Tour.status`
(DRAFT|PUBLISHED) plus `archivedAt` is this exact pattern again, except an
unenforced `status` publishes UNFINISHED CONTENT rather than merely quoting a
doubtful price. Three things made it come out right, and they generalise:

1. **Compose into the EXISTING predicate, do not add a parallel one.** Draft and
   archive were added as two more early-returns inside `isPubliclyListable()`.
   Every public surface already funnelled through it, so all of them — Home's
   rails, `/tour-packages`, the detail page, `/api/tours`, `/api/tours/[slug]`,
   `generateStaticParams()`, brochures — got the new protection with **no edit at
   the call site and no way to opt out**. A sibling `isPublished()` would have
   had to be retro-fitted to each caller, and the one that got missed would be
   the leak. That is variant 4 reproduced *within* one type.
2. **Make the field REQUIRED on the domain type, not optional.** An optional
   `status?` forces `undefined` to mean "published" (or the 22 existing fixture
   tours vanish) — i.e. default-open, where a forgotten mapper line silently
   publishes. Required means `tsc` names every construction site. It found all
   three, before any test ran. A type error is stronger enforcement than a test.
3. **Prove the absence-test can FAIL.** The new suite asserts a draft is absent
   from five public paths — and an absence assertion passes just as well when the
   surface is broken. So each half of the gate was commented out in turn: 9 of 12
   tests failed each time. Only then is a green run evidence.

Also worth copying: the migration hand-wrote `UPDATE "Tour" SET status =
'PUBLISHED'`. The column default is DRAFT, which is right for new rows and would
have taken all 22 live tours dark on the existing table — **a default chosen for
safety is the wrong value for a backfill**, and the two need separate thought.

And the inverse discipline, same pass: **no image columns were added** for the
not-yet-built upload feature. A column nothing writes and nothing reads IS the
inert-flag shape; the upload form ships visibly `disabled` with the reason stated
instead, and Phase C adds the columns with the code that fills them.

**SEVENTH opportunity, NOT an occurrence (Phase C uploads, 2026-09-18) — the
forecast above being cashed in, and the first one where the risk was a VALUE
rather than a flag.** Phase B's closing note said the image columns were withheld
because "a column nothing writes and nothing reads IS the inert-flag shape", and
that Phase C would "add the columns with the code that fills them". It did. Three
things generalise beyond this project:

1. **A required field is not an enforced one.** `coverImageUrl` is required to
   PUBLISH, which feels like enforcement and is not: the admin uploads, the
   column fills, the gate passes — and the visitor still sees a grey
   `PhotoPlaceholder`, because nothing carried the value through the public
   query. "Written and read by the validator" is not "read by the reader".
   The fix is the variant-1 playbook applied to a value: the render branch went
   into `PhotoPlaceholder`, the ONE component every card/hero/rail already routes
   through, so every surface inherited it with no call-site edit. The test that
   matters asserts the URL survives `PrismaContentAdapter.getAllTours()`, not
   that the column is set.
2. **Check whether an existing model already owns the thing you are about to add
   a column for.** `Tour.brochurePdfUrl` was the obvious place for the brochure
   upload and would have been variant 4 exactly: `Brochure.pdfUrl` already meant
   "this tour's brochure PDF" and was already what `/api/brochures/[slug]` and
   `BrochureModal` read, so the admin would have seen a successful upload while
   the public endpoint kept answering `pdfUrl: null, PENDING_UPLOAD` — with
   nothing anywhere reporting the disagreement. Grep the CONCEPT, not the column
   name, before adding a column.
3. **A derived value written at SAVE time is a silent side effect on every
   unrelated edit.** `photosCount` was briefly derived as `galleryImages.length`
   in the save path. It is not a form field, so editing a tour's *description*
   changed its photo count — caught going 11 → 0 on a real seeded row by the live
   integration test "editing one field of a live seeded tour leaves every other
   field untouched", which then had to repair live data. Derive at READ time, or
   not at all. The inverse of the inert-column defect: not "written and never
   read" but "written when nobody asked".

Also worth copying: the absence-assertions were mutation-tested before being
believed — `overwrite: true` was spliced into the upload options and the publish
gate was stubbed to `if (false)`, each confirming the relevant tests went red.
Phase B's discipline 3 ("prove the absence-test can FAIL"), applied to a property
that would otherwise rot silently the day someone "fixes a duplicate".

Tell-tale in review: `grep` the flag name. If the only hits are the definition, the data, and a test asserting the flag exists, nothing enforces it. If the flag renders a *visual* marker, check the marker reaches assistive tech too — an `aria-hidden` glyph plus an unreferenced footnote is an un-enforced flag wearing a costume.

**Why:** flagging feels like compliance with "don't fabricate", so the agent stops there. A test that asserts the flag is set passes whether or not the flag does anything.
**How to apply:** when an agent flags data as unverified/placeholder, require in the same change: (1) a consumer that withholds or visibly marks it, ideally at the query/adapter boundary rather than per-component, and (2) a test asserting the *rendered/returned* result excludes or marks it — never a test that only asserts the flag's presence. Decide explicitly what a direct URL to withheld content does (404 vs marked page).

**Also (from variant 4):** when adding a NEW public surface, check whether any entity it
renders already carries a safety flag in another fixture. Gates get written against the
type in front of the agent (`Package`) and silently do not cover a sibling type
(`GroupDeparture`) holding the same real-world entity. Grep the entity *name*, not just
the flag.

**And pair the flags with a test, not just a comment (variant 4's fix):** where the same
entity legitimately lives in two models, a test that cross-checks the two fixtures'
flags against each other is what stops the drift — in both directions. The dangerous
direction is not only "a new surface misses the flag" but "the price gets confirmed and
only one of the two flags is cleared", which silently re-publishes the other.

**Choosing withhold vs. mark (the product half, user-decided):** withhold when the
unconfirmed figure is wrapped in a *claim* the data cannot support (a "was ₹X / Save ₹Y"
badge); mark when it is a standalone figure. All four variants above are the same
mistake, but the proportionate remedy differs, and it is a business call, not the
agent's — put both options to the user with the consequence of each (here: withholding
would have emptied a quarter of the departures page).

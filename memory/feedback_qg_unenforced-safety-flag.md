---
name: QG pattern — safety flags that nothing reads
description: Recurring finding: an agent marks unsafe data with a flag/TODO and ships it rendering normally. Inject when any agent flags data as unverified.
type: feedback
---

Pattern: asked not to guess at unconfirmed data, agents do the right first half — add a field like `pricingUnverified`, a `TODO(confirm)` comment, a doc block explaining the risk — and then never write the consumer that acts on it. The flag reads as a fix in review and in the diff, but at runtime the unsafe record renders exactly like a confirmed one. Documentation is mistaken for enforcement.

Occurrences: 4
Last seen: 2026-09-11
Affected agents: frontend, backend, func-to-tech-spec
Pipeline: SPEC (GTY website)

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

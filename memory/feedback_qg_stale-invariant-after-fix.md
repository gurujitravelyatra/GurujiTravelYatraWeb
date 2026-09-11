---
name: QG pattern — a fix changes an invariant, its dependents are not swept
description: Recurring finding: a correct fix silently invalidates layout constants, comments, metadata and sibling components that assumed the old invariant. Inject when a fix changes a data set size or a route's contract.
type: feedback
---

Pattern: an agent makes a correct, well-reasoned fix that changes an
invariant — how many records a query returns, or what a route now reads —
and fixes only the thing it was asked about. Everything that was authored
against the OLD invariant keeps compiling, keeps passing tests, and starts
lying. The second- and third-order effects are never swept, so each review
round finds the previous round's ripples.

Occurrences: 4 (all four found in a single pre-merge review round —
counted as instances, not as separate pipelines)
Last seen: 2026-09-11
Affected agents: frontend, func-to-tech-spec, pipeline-executor
Pipeline: SPEC (GTY website)

Examples, all downstream of two earlier correct fixes:

Fix A — `public-listing.ts` withheld 3 `pricingUnverified` tours. Ripples:
- [RESOLVED `ac1ffc5`] Popular Destinations went 5 cards → 2, but the grid
  still declared `1080:grid-cols-5` (three empty trailing columns), the dot
  indicator still drew 5 dots, and `PackageRail`'s scroll arrow still
  rendered on a 2-card row with nothing to scroll.
- [RESOLVED `09d8601`] Filtering the 4 rails independently now yields 1 card
  plus 3 "No journeys match this filter yet." boxes — a working deep link
  that reads as a broken page.

Fix B — `/tour-packages` started reading `?category=` / `?destination=`. Ripples:
- [RESOLVED `7fd81fa`] `TripFinderBar`'s CTA stayed one static link, under a
  comment that still asserted the route "takes no category query param
  either" — while its own hints said "filter by Spiritual on Tour Packages".
- [RESOLVED `72a395f`] The route became per-request, so every filter combo
  became a separately crawlable near-duplicate URL with an identical title
  and description, and no canonical.

Tell-tale in review: after any fix that changes a collection's size or a
route's contract, `grep` for hardcoded counts (`grid-cols-N`, dot arrays,
`length === N`), for sibling components rendering the same collection, and
for comments containing "no ... param", "always", "all N". A comment that
describes behaviour is a test that never runs.

**Why:** the agent's context is the single finding it was handed. Nothing in
the task framing asks "what else assumed this?", and neither the type system
nor the existing tests can catch a layout constant or a prose comment that
has quietly become false.

**How to apply:** when dispatching a fix that changes how many items a query
returns, or what inputs a route accepts, require in the same change: (1) a
sweep of every consumer of that collection/route, named explicitly in the
handoff; (2) derived layout — column counts, indicators, affordances — driven
from `items.length` or measured, never a literal; (3) re-read the doc
comments in every file touched, since stale prose survives every gate.

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

Occurrences: 7 (four found in a single pre-merge review round in Sept 11 —
counted as instances, not as separate pipelines — plus the admin-reversal
sweep on 2026-09-17, plus two in the 2026-09-19 review round)
Last seen: 2026-09-23
Affected agents: frontend, func-to-tech-spec, pipeline-executor
Pipeline: SPEC (GTY website)
**Past the escalation threshold (5)** — recommend a standing rule in
`_base-impl.md`: "after any fix, grep the OLD claim across code, comments,
docs, E2E and memory before committing" (not done by the executor: config change).

Occurrences 6-7 (2026-09-19 review round):
- **M5 (review):** `schema.prisma` and BLOCKERS item 12 still described a
  save-time `photosCount` derivation that Phase C had REVERTED to read-time.
  The revert fixed the code and its comment; the two docs a reader goes to first
  were never swept.
- **Fix round, self-caught by the full E2E run:** the M3 upload-origin fix
  reworded the 403 message; `admin-csrf.spec.ts` still matched `/cross-site/`,
  and BLOCKERS item 12 still called the old one-value check "covered". Status
  codes were unchanged, so only the prose assertion and the prose doc lied.

Occurrence 5 — the ARCHITECTURE-RULE variant, and the most dangerous one so
far. Reversing the "zero admin/login/CMS" rule (Phase A auth) invalidated
every claim written against it. Found and swept proactively by grepping
`-i "no admin|admin UI|zero admin|no login"` BEFORE writing code:
- `src/app/legal/privacy-policy/page.tsx` — told real visitors "there is no
  login area on this website". A **legal page making a false statement** is
  the worst possible resting place for a stale invariant, and nothing in the
  type system or the suite could have caught it.
- `prisma/schema.prisma` + `.env.example` + `docker-compose.yml` — three
  guardrail comments asserting "NO admin UI", one of them phrased as a
  tripwire for future agents. A stale guardrail is worse than no guardrail:
  it actively tells the next reader the correct change is a violation.
- `e2e/home.spec.ts` — asserted `/admin` returns 404. This one FAILS loudly,
  which is why it is the least dangerous of the five and the only one a test
  run would have surfaced.

The lesson that generalises: when the invariant being changed is a RULE
rather than a data shape, its dependents are mostly prose — comments, docs,
guardrails, user-facing copy — and prose is exactly what no gate checks. The
grep must run before the code, not after.

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

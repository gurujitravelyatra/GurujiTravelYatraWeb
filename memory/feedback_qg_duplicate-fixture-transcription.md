---
name: QG pattern — same entity transcribed into two fixtures, then silently reconciled
description: Recurring finding: an entity appears in two places in a design export, gets two fixture records, and a helper hides the conflict. Inject into frontend/func-to-tech-spec prompts.
type: feedback
---

Pattern: a design export shows the same entity in two different sections (a "popular" grid and a category rail, a summary card and a detail panel). Agents transcribe each section into its own fixture array, producing two records for one real entity — with values that disagree, because the export's own two renderings disagreed. A later helper then merges them and picks a winner on key collision, which reads as reasonable code while silently deciding which price the customer sees.

Occurrences: 2
Last seen: 2026-09-11
Affected agents: frontend, func-to-tech-spec
Pipeline: SPEC (GTY website)

Examples:
- [RESOLVED `35ff926`] `popular.fixture.ts` + `packages.fixture.ts` — "Do Dham Yatra", "Kashmir Family Escape", "Kashi Darshan" defined twice with different duration/was-price/savings/category/photo count. Both fed `PackageCard`s linking to the same `/tour-packages/{slug}`, so Home advertised "7 Days, was ₹31,900" and the detail page said "6 Days, was ₹32,400" for the same tour. `get-all-packages.ts` resolved it with `bySlug.set()` ordering — a one-line comment describing a pricing decision.

- [RESOLVED `af92be2`] Second occurrence, and it slipped through because the duplication
  was *deliberate* this time. `group-departures.fixture.ts` transcribes the export's
  `GROUPS` section, which re-states two tours `packages.fixture.ts` already holds
  ("Do Dham Yatra", "Spiti Valley Circuit"). Keeping them as a separate `GroupDeparture`
  model was defensible — a departure has real fields a package has none of (dates, seats,
  boarding points) and explicitly must NOT inherit `priceWas`/`savingsLabel`. What was
  missed is that a *safety flag* on the shared entity has to be replicated by hand across
  the two models: the duration conflict was carried over, the `pricingUnverified` price
  was not, so `/group-tours` published ₹28,900 while `/tour-packages` withheld it
  (BLOCKERS.md item 9). Fixed with `priceUnverified` + a test cross-checking the two
  fixtures' flags and price strings against each other.

**Why:** the anti-fabrication rule ("transcribe verbatim, invent nothing") actively pushes toward this defect — faithfully transcribing two contradictory renderings is exactly how you end up with two contradictory records. Fidelity to a source is not the same as consistency of the model, and nothing in the spec-time checks tested for it.
**How to apply:** when dispatching `frontend` or `func-to-tech-spec` with a design export, add: "An entity that appears in two sections of the export is ONE record, not two. Derive each section as a view (filter/order) over a single canonical array — never transcribe it twice. If the export's two renderings disagree, do not pick one and do not average them: keep one record, flag the disputed fields, and raise it as a product decision. Add a uniqueness test over the canonical key before writing any component."

**Added after occurrence 2:** where two models for one entity ARE justified (they carry
genuinely different fields), say so explicitly and then treat every safety flag on the
shared entity as a cross-model obligation: replicate it, and add a test that compares the
two fixtures' flags AND the disputed values directly, so neither can drift — including
when the value is finally confirmed and only one side is cleared.

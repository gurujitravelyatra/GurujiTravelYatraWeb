---
name: QG pattern — safety flags that nothing reads
description: Recurring finding: an agent marks unsafe data with a flag/TODO and ships it rendering normally. Inject when any agent flags data as unverified.
type: feedback
---

Pattern: asked not to guess at unconfirmed data, agents do the right first half — add a field like `pricingUnverified`, a `TODO(confirm)` comment, a doc block explaining the risk — and then never write the consumer that acts on it. The flag reads as a fix in review and in the diff, but at runtime the unsafe record renders exactly like a confirmed one. Documentation is mistaken for enforcement.

Occurrences: 2
Last seen: 2026-09-11
Affected agents: frontend, backend, func-to-tech-spec
Pipeline: SPEC (GTY website)

Examples:
- [RESOLVED `14c6a65`] `Package.pricingUnverified` was set on 3 tours, documented in the type, in the fixture, and asserted by a test that only checked *the flag was still set* — while those tours rendered full "was ₹X / Save ₹Y" discount badges on 3 of 5 Home cards. Fixed by enforcing at the content-query level (`public-listing.ts`), so no listing can return a flagged record and the detail route 404s, with a test asserting no flagged record appears in ANY public listing result.
- [RESOLVED `617f8d8`] Related shape: `Review.isPlaceholder` WAS enforced (dashed border + "Placeholder" pill), but the same class of unconfirmed content in `stats.fixture.ts` had no flag at all and rendered as settled fact — including "98% Traveller Satisfaction" with no review data behind it.

Tell-tale in review: `grep` the flag name. If the only hits are the definition, the data, and a test asserting the flag exists, nothing enforces it.

**Why:** flagging feels like compliance with "don't fabricate", so the agent stops there. A test that asserts the flag is set passes whether or not the flag does anything.
**How to apply:** when an agent flags data as unverified/placeholder, require in the same change: (1) a consumer that withholds or visibly marks it, ideally at the query/adapter boundary rather than per-component, and (2) a test asserting the *rendered/returned* result excludes or marks it — never a test that only asserts the flag's presence. Decide explicitly what a direct URL to withheld content does (404 vs marked page).

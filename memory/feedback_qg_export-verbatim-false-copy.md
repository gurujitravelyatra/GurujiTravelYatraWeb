---
name: QG pattern — export-verbatim copy asserting things that aren't true
description: Recurring finding: pixel-fidelity mandates get applied to COPY, shipping false claims. Inject into frontend/spec agent prompts.
type: feedback
---

Pattern: when a design export is the source of truth for pixel fidelity, agents transcribe its **copy** verbatim too — including sentences that assert a capability or fact the build does not have. A wireframe's filler text is not a specification of truth.

Occurrences: 3
Last seen: 2026-09-11
Affected agents: frontend, func-to-tech-spec
Pipeline: SPEC (GTY website)

Examples (most recent first):
- [RESOLVED `3862a5d`/`617f8d8`] Third occurrence, found by an independent pre-merge adversary AFTER the first two were fixed: `TourPackagesHero` "easy filters and real-time availability" (no availability data exists at all); `JourneyVideoBlock` "▶ Watch Full Video" (no video asset anywhere); `not-found.tsx` "This page is coming soon" on every 404 including typos; `LeadModal` promising pre-submit that "our team will review your enquiry" on a path that always fails; an invented Instagram handle `@guruji_travel_yatra`.
- [RESOLVED `893ccaf`] `tabs.fixture.ts` — hints asserting seat availability, a Nepal trip (in no fixture) and a nine-question "trip builder" that does not exist.
- [RESOLVED `80d46e3`] `LeadModal.tsx` "Server-side validated, rate-limited." / "Creating your lead in the CRM"; `videos.fixture.ts` "Departed 06 Oct 2026" rendered before that date.

**The third occurrence's real lesson — ENFORCEMENT SCOPE, not prompt strictness.** The COPY FIDELITY RULE and its data-derived test already existed when occurrence 3 shipped. They caught nothing because the test was scoped to ONE fixture file (`tabs.fixture.ts`), so a false claim hardcoded in JSX was invisible to it. Worse, that test checked place names against all 22 fixture records while the CTA it describes lands on a page rendering ~17 — so it green-lit hints naming tours a visitor could not reach.

**Why:** an anti-fabrication rule that covers *data* does not automatically cover *assertions in copy*, and a copy test that covers one file does not cover a page.
**How to apply:** when dispatching `frontend` or `func-to-tech-spec` with a design export, add: "Pixel fidelity governs layout, spacing, type and colour — NOT the truth of copy. Any sentence asserting a capability, date or statistic must be verified against what the build does; if it isn't true, flag it as a product decision. Copy-fidelity tests must scan RENDERED output of the whole page and derive expectations from the data the visitor will actually see at the link's destination — never from a single fixture file."

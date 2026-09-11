---
name: QG pattern — export-verbatim copy asserting things that aren't true
description: Recurring finding: pixel-fidelity mandates get applied to COPY, shipping false claims. Inject into frontend/spec agent prompts.
type: feedback
---

Pattern: when a design export is the source of truth for pixel fidelity, agents transcribe its **copy** verbatim too — including sentences that assert a capability or fact the build does not have. A wireframe's filler text is not a specification of truth.

Occurrences: 1
Last seen: 2026-09-11
Affected agents: frontend, func-to-tech-spec
Pipeline: SPEC (GTY website)

Examples:
- [RESOLVED `80d46e3`] `src/components/modals/LeadModal.tsx` — "Server-side validated, rate-limited." There is no server, no API route, no rate limiter; validation is client-side Zod only. Said to someone about to type their mobile and email.
- [RESOLVED `80d46e3`] `src/components/modals/LeadModal.tsx` — "Creating your lead in the CRM", shown on a path that by design always fails.
- [RESOLVED `80d46e3`] `src/content/fixtures/videos.fixture.ts` — "Departed 06 Oct 2026" rendered on 2026-09-11, i.e. a trip that has not left yet described in the past tense.
- [OPEN] `src/content/fixtures/tabs.fixture.ts` — every Trip Finder tab hint asserts a filter that does not run: "Showing upcoming departures with seats still open" (no departure/seat data exists anywhere in the model), "Showing family-paced trips: Kashmir, Nepal, Rameshwaram" (Nepal is in no fixture), "Takes you to the trip builder — nine short questions" (no trip builder exists; the CTA goes to `/tour-packages`). Needs a product decision on what the tabs should claim — deliberately NOT guessed.

A regression test now pins the resolved cases: `LeadModal.enquiry.test.tsx` asserts the rendered modal matches none of /server-side/i, /rate.?limit/i, /\bCRM\b/, /encrypted/i; `fixture-content-adapter.test.ts` asserts no video caption contains a year, "departed" or "travellers".

**Why:** an anti-fabrication rule that covers *data* (prices, names, reviews) does not automatically cover *assertions in copy*, so agents satisfy the rule and still ship falsehoods. Three distinct classes slipped through in one sprint.
**How to apply:** when dispatching `frontend` or `func-to-tech-spec` with a design export, add: "Pixel fidelity governs layout, spacing, type and colour — NOT the truth of copy. Any sentence in the export that asserts a capability (validation, rate limiting, CRM writes, search, 'showing results'), a date, or a statistic must be verified against what the build actually does. If it isn't true, flag it as a product decision rather than transcribing it."

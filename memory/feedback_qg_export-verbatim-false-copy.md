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
- `src/components/modals/LeadModal.tsx:271` — "Server-side validated, rate-limited." There is no server, no API route, no rate limiter; validation is client-side Zod only. Said to someone about to type their mobile and email.
- `src/components/modals/LeadModal.tsx:318` — "Creating your lead in the CRM", shown on a path that by design always fails.
- `src/content/fixtures/videos.fixture.ts:9` — "Departed 06 Oct 2026" rendered on 2026-09-11, i.e. a trip that has not left yet described in the past tense.

**Why:** an anti-fabrication rule that covers *data* (prices, names, reviews) does not automatically cover *assertions in copy*, so agents satisfy the rule and still ship falsehoods. Three distinct classes slipped through in one sprint.
**How to apply:** when dispatching `frontend` or `func-to-tech-spec` with a design export, add: "Pixel fidelity governs layout, spacing, type and colour — NOT the truth of copy. Any sentence in the export that asserts a capability (validation, rate limiting, CRM writes, search, 'showing results'), a date, or a statistic must be verified against what the build actually does. If it isn't true, flag it as a product decision rather than transcribing it."

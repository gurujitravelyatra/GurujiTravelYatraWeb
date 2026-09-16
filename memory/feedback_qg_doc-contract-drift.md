---
name: QG pattern — spec docs describe a contract the code never implemented
description: Recurring QG finding: an authoritative-looking spec doc is used as the source of truth for a contract the running code contradicts. Inject when an agent builds an interface from a doc.
type: feedback
---

Pattern: `Documents/*.md` read as the contract for something the code already
decides differently. The docs are aspirational in places and were written
before the components; nothing keeps them honest, so an agent that follows
them faithfully ships the wrong interface — and does it confidently, because
the doc looks authoritative and is literally named as the source of truth.
Occurrences: 2
Last seen: 2026-09-17
Affected agents: pipeline-executor, backend, func-to-tech-spec
Pipeline: SPEC / BACKEND-ONLY

Examples:
- `POST /api/leads` (2026-09-16, stopped): contract derived from CLAUDE.md §5
  said `phone` and a `tourSlug`; the modals actually send `mobile` and
  `interestedIn` (a DISPLAY string, e.g. `"Spiti Valley Circuit · 9 Nights /
  10 Days"`), plus `travellers`/`city`/`sourcePageUrl`/`utm` the docs never
  mentioned. Caught before the code was written, but only by chance.
- Same route (2026-09-17, built): the docs' six source tags include two whose
  pages do not exist and one (`Newsletter Signup`) with no wired form. The
  docs also promise Custom Trip Request carries a "budget" — `TripBuilder`
  collects no budget input at all; `travelStyle`
  (Budget/Comfort/Premium/Luxury) is the only price-tier signal there is.

**The sharpest version of this trap:** a doc can describe a flow that no code
path produces. `TripBuilder.handleGetQuote` and `GroupDepartureCard`'s
"Reserve a Seat" both call `openEnquiry(...)`, so they emit
`Enquire Now – …` and silently DISCARD the trip state / batch date the docs
say those leads carry. Reading only the docs, you would model four submission
shapes; reading the code, there is exactly one (`LeadModal.runSubmit` →
`LeadPayload`). Both facts matter — build for the documented four, but never
report the unwired ones as "confirmed from the frontend".

**Why:** twice now, on the same feature, the documented field names and the
shipped ones disagreed. The docs are not malicious, just older than the code.
**How to apply:** when building any interface between layers, read the
CALLER'S CODE first and treat the doc as a requirements hint, not a schema.
Then state per field where it was confirmed. If a doc names a flow with no
producer, say so explicitly rather than silently designing for it — and fix
the doc in the same change, or the next agent repeats this exactly.

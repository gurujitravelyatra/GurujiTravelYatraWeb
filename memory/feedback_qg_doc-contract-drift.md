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
"Reserve a Seat" both called `openEnquiry(...)`, so they emitted
`Enquire Now – …` and silently DISCARDED the trip state / batch date the docs
said those leads carry. Reading only the docs, you would model four submission
shapes; reading the code, there was exactly one (`LeadModal.runSubmit` →
`LeadPayload`). Both facts matter — build for the documented four, but never
report the unwired ones as "confirmed from the frontend".

**[RESOLVED 2026-09-17, `95f0fe7`..`8d807fa`]** The two unwired flows now have
real producers (`openCustomTrip`, `openGroupReservation`) and BLOCKERS.md item 0
is closed. The handling that worked, and is worth repeating:

- The server schema was written from the CALLER'S CODE and left alone; the
  client was changed to match it. Building a four-member union against a client
  that could produce two was correct *because the gap was named in the same
  change* rather than papered over.
- The client request builder's return type is the server's own
  `z.infer` type, imported type-only. Drift now fails `tsc` instead of 400ing a
  visitor — a compile-time link is worth more than any amount of doc-syncing.
- The payload tests re-run the REAL `leadSubmissionSchema` rather than asserting
  against a hand-written copy of the expected shape. Asserting a payload against
  your own belief about the contract is this pattern's signature failure.
- The docs' `budget` field was still not invented: `TripBuilder` collects none,
  so `travelStyle` is what ships. Third time this doc's claims were declined.

**Why:** twice now, on the same feature, the documented field names and the
shipped ones disagreed. The docs are not malicious, just older than the code.
**How to apply:** when building any interface between layers, read the
CALLER'S CODE first and treat the doc as a requirements hint, not a schema.
Then state per field where it was confirmed. If a doc names a flow with no
producer, say so explicitly rather than silently designing for it — and fix
the doc in the same change, or the next agent repeats this exactly.

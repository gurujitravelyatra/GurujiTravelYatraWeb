-- DATA-ONLY migration (2026-09-25, the departures pass). No schema change.
--
-- ## Why this exists
--
-- Phase B (`20260917161233_add_tour_cms_phase_b`) added `GroupDeparture.tourSlug`
-- as a NULLABLE column and backfilled nothing. The link was only ever WRITTEN by
-- `prisma/seed.ts`, which derives it from the departure's name
-- (`src/content/departure-tour-link.ts`) — and the live database was seeded
-- BEFORE Phase B and never re-seeded. Measured 2026-09-25 against the live
-- database: all 4 seeded departures had `tourSlug` NULL.
--
-- That mattered the moment the departure visibility gate landed in this same
-- pass: `toPublicDeparture()` withholds a departure whose linked tour is a draft
-- or archived, and an UNLINKED departure answers to no tour. So on the live
-- database, archiving "Spiti Valley Circuit" would have left its dated batch
-- listed and bookable on `/group-tours` — the exact defect the gate exists to
-- close — while every mocked test said the gate worked. It was caught only by
-- the live integration suite (`departure-gate.integration.test.ts`), when a
-- mutation that dropped linked rows from the query still left every seeded row
-- listed.
--
-- ## What it writes
--
-- Exactly the two links the seed's rule derives, written out literally rather
-- than re-deriving the rule in SQL (a second copy of the rule is the drift the
-- shared module exists to prevent; `departure-visibility.test.ts` pins these two
-- pairs as the rule's output, so the literal and the rule are checked against
-- each other):
--
--   do-dham-yatra-kedarnath-badrinath  ->  do-dham-yatra
--   spiti-valley-circuit               ->  spiti-valley-circuit
--
-- "Chardham Special" and "Kashi · Ayodhya · Prayagraj" have no catalogue twin
-- and correctly stay NULL.
--
-- ## Why it is safe
--
--  - Guarded: only a NULL link is filled, and only when BOTH rows exist — so it
--    is a no-op on a freshly seeded database (already linked), on one where an
--    admin has since linked or re-linked the row, and on one without these rows.
--  - No visible change today: both tours are PUBLISHED and unarchived, so both
--    departures stay listed. Do Dham's tour is `pricingUnverified`, and its
--    departure was ALREADY marked `priceUnverified` — linking it changes nothing
--    a visitor sees (BLOCKERS.md item 9: marked, not withheld).
--  - Reversible: `UPDATE "GroupDeparture" SET "tourSlug" = NULL WHERE slug IN (...)`.

UPDATE "GroupDeparture" AS d
SET "tourSlug" = 'do-dham-yatra'
WHERE d."slug" = 'do-dham-yatra-kedarnath-badrinath'
  AND d."tourSlug" IS NULL
  AND EXISTS (SELECT 1 FROM "Tour" t WHERE t."slug" = 'do-dham-yatra');

UPDATE "GroupDeparture" AS d
SET "tourSlug" = 'spiti-valley-circuit'
WHERE d."slug" = 'spiti-valley-circuit'
  AND d."tourSlug" IS NULL
  AND EXISTS (SELECT 1 FROM "Tour" t WHERE t."slug" = 'spiti-valley-circuit');

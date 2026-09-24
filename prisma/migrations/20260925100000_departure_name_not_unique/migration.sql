-- GroupDeparture.name is no longer unique (2026-09-25, the departures pass).
--
-- The admin tour form can now create several batches of one tour. Each batch is
-- its own `GroupDeparture` row, and they share a title ("Spiti Valley Circuit")
-- while differing in dates and seats — the ordinary case, not an edge case. The
-- unique index, inherited from the init migration when the four departures were
-- a fixed, hand-transcribed set, would refuse the second batch of every tour.
--
-- Nothing relied on the uniqueness: `slug` is the primary key and the identity
-- every consumer keys on (React keys, `data-testid`, the admin's batch sync);
-- a lead carries the batch's `dateRangeLabel` beside its name, so it stays
-- attributable to one batch.
--
-- Hand-written, not generated: `migrate diff` needs a shadow database, and the
-- only database reachable here is the live one, which must never be used as a
-- shadow (Prisma resets it). The statement matches the index name created in
-- `20260914120000_init` exactly.

-- DropIndex
DROP INDEX "GroupDeparture_name_key";

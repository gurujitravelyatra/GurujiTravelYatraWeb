/**
 * Sold-out state is DERIVED from `seatsLabel`, never stored alongside it.
 *
 * The design export encodes availability ONLY as the literal string "Sold out"
 * in the seat-count field — there is no separate availability flag anywhere in
 * the source data. `GroupDeparture.isSoldOut` exists so components do not each
 * re-parse that string, not because it is independent information.
 *
 * This lives in its own module because there are now two producers of
 * `GroupDeparture` — `group-departures.fixture.ts` and `PrismaContentAdapter` —
 * and a derivation rule copied into both is a rule that will eventually disagree
 * with itself. Note the database deliberately does NOT have an `isSoldOut`
 * column for the same reason: a stored copy can drift from the `seatsLabel` it
 * was derived from, and then the card says "Sold out" while the seat count says
 * 14 remain.
 */
export function deriveIsSoldOut(seatsLabel: string): boolean {
  return seatsLabel.trim().toLowerCase() === 'sold out';
}

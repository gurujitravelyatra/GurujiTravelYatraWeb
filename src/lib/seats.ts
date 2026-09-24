/**
 * Seats available on a departure — the ONE place `seatsLabel`'s written form is
 * defined. Added 2026-09-25 with the admin departures editor.
 *
 * `GroupDeparture.seatsLabel` is display text ("14 seats left" | "Sold out")
 * because the design export encoded availability that way, and sold-out state is
 * DERIVED from it (`src/content/sold-out.ts` — there is deliberately no
 * `isSoldOut` column to drift). The admin form collects a COUNT and this module
 * writes the label, so:
 *
 *  - the admin cannot type "few seats left!" into the field a visitor reads as a
 *    number, and
 *  - 0 always becomes exactly "Sold out", the one string `deriveIsSoldOut`
 *    recognises — so a batch with no seats cannot keep offering a Reserve button
 *    because someone wrote "0 seats left".
 *
 * No `seatsAvailable` column was added. A count column beside the label would
 * be two sources of truth for one fact — the drift `sold-out.ts` already refuses
 * for `isSoldOut`.
 */

/** A generous ceiling: no coach or group GTY runs approaches it, and it bounds the input. */
export const MAX_SEATS = 999;

export const SEATS_FORMAT_MESSAGE = `Enter the seats still available as a whole number from 0 to ${MAX_SEATS} (0 means sold out).`;

/** The label for `count` seats. Zero-padded to two digits, as the export writes them ("08 seats left"). */
export function formatSeatsLabel(count: number): string {
  if (!Number.isInteger(count) || count < 0 || count > MAX_SEATS) {
    throw new Error(`formatSeatsLabel: not a valid seat count: ${count}`);
  }
  if (count === 0) return 'Sold out';
  return `${String(count).padStart(2, '0')} ${count === 1 ? 'seat' : 'seats'} left`;
}

/** A form value (`"14"`) → the count, or `undefined` unless it is a whole number in range. */
export function parseSeatsInput(value: string): number | undefined {
  if (!/^\d{1,3}$/.test(value)) return undefined;
  const count = Number(value);
  return count <= MAX_SEATS ? count : undefined;
}

/**
 * A STORED label → the count, for pre-filling the admin form. `undefined` for a
 * label in any other shape, in which case the form asks for the number rather
 * than guessing it.
 */
export function readSeatsLabel(label: string): number | undefined {
  if (label.trim().toLowerCase() === 'sold out') return 0;
  const match = /^(\d{1,3}) seats? left$/.exec(label.trim());
  if (!match) return undefined;
  const count = Number(match[1]);
  return count <= MAX_SEATS ? count : undefined;
}

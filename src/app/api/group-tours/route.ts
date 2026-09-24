import { contentAdapter } from '@/content/content-adapter';

import { apiSuccess, handleRoute } from '../_lib/json';
import { toGroupDepartureJson } from '../_lib/serializers';

export const dynamic = 'force-dynamic';

/**
 * `GET /api/group-tours` — fixed departures for `/group-tours`.
 *
 * ## A departure of a HIDDEN tour is withheld (2026-09-25)
 *
 * `contentAdapter.getGroupDepartures()` ends in `toPublicDeparture()`, which
 * withholds a departure whose linked tour is a draft or archived — so archiving
 * a tour withdraws its batches from this endpoint too, rather than leaving real
 * dates and seats bookable for a trip the business pulled. Unlinked departures
 * (`tourSlug` NULL) answer to no tour and stay listed.
 *
 * ## Price doubt is MARKED, not withheld — and the response carries the marks
 *
 * Unlike `/api/tours`, a departure is NOT withheld for an unconfirmed price,
 * and that asymmetry is a deliberate product decision rather than an oversight:
 * BLOCKERS.md item 9 records the user choosing "marker + footnote, not
 * withholding" for departures. The reasoning was proportionality — the
 * withholding gate exists because a fabricated "was ₹X / Save ₹Y" discount badge
 * was at stake on the tour cards, whereas a departure card shows a single
 * standalone figure and no such badge, and withholding would have emptied a
 * quarter of the departures page. A departure's dates, boarding points and seat
 * counts are real regardless of whether its price is confirmed.
 *
 * The consequence for THIS endpoint is the important part: because the records
 * are not withheld, the honesty burden moves onto the payload.
 * `priceUnverified` and `durationUnverified` are therefore emitted as real
 * booleans on every departure (see `toGroupDepartureJson`), so a consumer can
 * render the same asterisk-and-footnote treatment `GroupDepartureCard` renders.
 *
 * Stripping those flags to tidy the response would leave a consumer holding
 * "₹28,900" with no way to learn the site itself does not vouch for it — turning
 * this endpoint into the surface that republishes a figure every other surface
 * marks as doubtful. That is the recurring defect in
 * `memory/feedback_qg_unenforced-safety-flag.md`, whose generalisation is
 * exactly this: when data crosses into a new store or surface, port the
 * ENFORCEMENT, not just the field.
 */
export async function GET() {
  return handleRoute('GET /api/group-tours', async () => {
    const departures = await contentAdapter.getGroupDepartures();
    return apiSuccess(departures.map(toGroupDepartureJson));
  });
}

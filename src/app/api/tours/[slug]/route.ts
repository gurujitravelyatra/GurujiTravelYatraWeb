import { getPackageBySlug } from '@/content/get-all-packages';

import { apiFailure, apiSuccess, handleRoute } from '../../_lib/json';
import { toTourJson } from '../../_lib/serializers';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

/**
 * `GET /api/tours/[slug]` — one tour, or a JSON 404.
 *
 * ## The withholding rule, and why this route resolves the way it does
 *
 * It calls `getPackageBySlug()` — the SAME resolver `/tour-packages/[slug]`
 * uses — and not a direct lookup by slug. That is the entire safety design of
 * this file, so it is worth stating why plainly.
 *
 * `getPackageBySlug()` is defined as a `.find()` over `getAllTours()`, i.e. over
 * the already-gated public set. A `pricingUnverified` tour is absent from that
 * set, so it resolves to `undefined` here for the same reason its page 404s. The
 * flag is enforced by CONSTRUCTION: there is no code path in this file that
 * could return a withheld tour, because it never sees one.
 *
 * A `prisma.tour.findUnique({ where: { slug } })` would have looked equivalent,
 * passed a happy-path test, and quietly published all three withheld tours —
 * their unconfirmed prices and their fabricated "was ₹X / Save ₹Y" savings
 * labels — on a brand-new public surface. That is not hypothetical: it is
 * variant 4 in `memory/feedback_qg_unenforced-safety-flag.md`, where the
 * `Package`-scoped gate failed to cover `/group-tours` when that page was built
 * later. This route is the fifth opportunity for that same bug and is
 * deliberately built so it cannot occur. `tours-slug.test.ts` asserts the
 * withheld slug 404s by driving the real gate, not by mocking it away.
 *
 * ## 404 body, not a Next.js 404 page
 *
 * `notFound()` renders the branded HTML 404 shell, which is right for a page and
 * wrong for an API: a JSON client would get `text/html` and fail at `.json()`
 * with a parse error instead of reading a status. So this returns a JSON body.
 *
 * ## Withheld and nonexistent are deliberately INDISTINGUISHABLE
 *
 * Both return the same 404 with the same message. Returning a distinct status or
 * message for "this tour exists but we are withholding it" would confirm the
 * record's existence and let a caller enumerate exactly which tours carry
 * unconfirmed pricing — leaking the commercially sensitive half of the fact the
 * gate exists to suppress. The page route makes the same choice.
 */
export async function GET(_request: Request, context: RouteContext) {
  return handleRoute('GET /api/tours/[slug]', async () => {
    const { slug } = await context.params;
    const tour = await getPackageBySlug(slug);

    if (!tour) {
      return apiFailure(404, `No tour found for slug '${slug}'.`);
    }

    return apiSuccess(toTourJson(tour));
  });
}

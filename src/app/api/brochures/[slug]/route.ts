import { brochureAdapter } from '@/content/content-adapter';

import { apiFailure, apiSuccess, handleRoute } from '../../_lib/json';
import { toBrochureJson } from '../../_lib/serializers';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

/**
 * `GET /api/brochures/[slug]` — brochure metadata for one tour, keyed by TOUR
 * slug (`/api/brochures/spiti-valley-circuit`), matching
 * `BrochurePort.getBrochureByTourSlug`. A brochure has no identity of its own in
 * this model: `Brochure.tourSlug` is `@unique`, one current brochure per tour.
 * A path segment rather than `?tourSlug=` so it reads as addressing a resource,
 * consistent with `/api/tours/[slug]`.
 *
 * ## THIS ENDPOINT RETURNS NO DOWNLOAD LINK, AND THAT IS THE CORRECT ANSWER
 *
 * `pdfUrl` is `null` and `status` is `PENDING_UPLOAD` on every record, because
 * no brochure PDF exists anywhere in this project. The response says so
 * explicitly instead of omitting the field, so a consumer can distinguish "not
 * uploaded yet" from "this API does not report URLs".
 *
 * A consumer MUST treat a null `pdfUrl` as "no download available" — disable the
 * button, or do not render it — and MUST NOT synthesise a path such as
 * `/brochures/{slug}.pdf`. There is no such path and no such file; a
 * "Download Brochure" button that 404s is worse than one that is absent. The
 * `status` field carries the reason so the UI can say something true.
 *
 * ## Three distinct negative outcomes, three distinct responses
 *
 * These are kept apart deliberately, because collapsing them is how a temporary
 * outage gets cached as a permanent absence:
 *
 *  - **503** — no brochure store is configured (`DATABASE_URL` unset, so the
 *    composition root resolved to the fixtures, which have no brochure data at
 *    all). This is an environment/deployment fact, NOT a statement about the
 *    tour. Answering 404 here would tell a caller "this tour has no brochure",
 *    which is an assertion this process is in no position to make.
 *  - **404** — the store is live and holds no brochure for this slug. Includes
 *    the case where the slug's TOUR is withheld: `getBrochureByTourSlug` filters
 *    on `tour: { pricingUnverified: false }`, because a brochure for a withheld
 *    tour would republish the same unconfirmed price the catalogue suppresses —
 *    a brochure record is not a loophole around the pricing gate. As on
 *    `/api/tours/[slug]`, withheld and absent are indistinguishable on purpose.
 *  - **500** — the query itself failed (handled by `handleRoute`).
 */
export async function GET(_request: Request, context: RouteContext) {
  return handleRoute('GET /api/brochures/[slug]', async () => {
    const { slug } = await context.params;

    if (brochureAdapter === null) {
      return apiFailure(
        503,
        'Brochure data is not available in this environment. No content database is configured.'
      );
    }

    const brochure = await brochureAdapter.getBrochureByTourSlug(slug);

    if (!brochure) {
      return apiFailure(404, `No brochure found for tour '${slug}'.`);
    }

    return apiSuccess(toBrochureJson(brochure));
  });
}

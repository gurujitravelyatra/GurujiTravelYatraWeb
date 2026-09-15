/**
 * Seed for the interim content database — BLOCKERS.md §5.
 *
 * ## This file transcribes NOTHING
 *
 * It IMPORTS the fixtures and writes them to Postgres. It does not restate their
 * contents, and it must never start to.
 *
 * That is not a style preference. `memory/feedback_qg_duplicate-fixture-transcription.md`
 * records two occurrences of the defect where one entity ends up transcribed into
 * two places with values that disagree, and a helper silently picks a winner —
 * which is how Home once advertised "7 Days, was ₹31,900" for a tour whose detail
 * page said "6 Days, was ₹32,400". Hand-copying 22 tours into a seed file would be
 * occurrence three, with a database as the new place for the copies to drift.
 *
 * While both exist, `src/content/fixtures/*` remains the single source of truth and
 * this file is a projection of it. When the ERP content API lands, both go
 * (see BLOCKERS.md §5's exit plan).
 *
 * ## Destructive and idempotent
 *
 * Deletes the content tables and rewrites them, so re-running converges on exactly
 * the fixture content rather than accumulating drift. Safe because these tables
 * hold only seeded content — THERE ARE NO LEADS AND NO USER-GENERATED DATA in this
 * database, by design (BLOCKERS.md §5). If that ever changes, this strategy must
 * change with it.
 *
 * Run: `npx prisma db seed`
 */
import { PrismaClient } from '@prisma/client';
import { allTours, packageRails } from '../src/content/fixtures/packages.fixture';
import { popularPackages } from '../src/content/fixtures/popular.fixture';
import { groupDepartures } from '../src/content/fixtures/group-departures.fixture';
import { internationalDestinations } from '../src/content/fixtures/international.fixture';
import { CATEGORY_TO_PRISMA } from '../src/content/adapters/prisma-category';
import { slugify } from '../src/content/slug';

const prisma = new PrismaClient();

/**
 * Re-asserts the cross-model invariant that BLOCKERS.md item 9 exists to protect,
 * at the moment the data crosses into a new storage layer.
 *
 * `src/content/__tests__/group-departures.test.ts` already cross-checks the two
 * fixtures. This repeats the check here because a migration is exactly when such
 * an invariant gets quietly dropped: a seed that writes `priceUnverified: false`
 * for the Do Dham departure would republish ₹28,900 with no marker, undoing that
 * fix without touching any file the test watches.
 *
 * Throws rather than warns. A seed that has already written half a dataset is
 * worse than one that refused to start.
 */
function assertSafetyFlagsAgree(): void {
  for (const departure of groupDepartures) {
    // Departure names carry a suffix the catalogue does not ("Do Dham Yatra —
    // Kedarnath & Badrinath" vs "Do Dham Yatra"), so match on the price string
    // for the tours that exist in both, which is what the flag is actually about.
    const twin = allTours.find((tour) => tour.priceFrom === departure.priceFrom);
    if (!twin) continue;

    if (twin.pricingUnverified && !departure.priceUnverified) {
      throw new Error(
        `Seed refused: departure "${departure.slug}" carries ${departure.priceFrom}, the same unconfirmed price ` +
          `the catalogue withholds for "${twin.slug}" (pricingUnverified), but is not flagged priceUnverified. ` +
          `See BLOCKERS.md item 9 — the two flags must be cleared together, not one at a time.`
      );
    }
    if (!twin.pricingUnverified && departure.priceUnverified) {
      throw new Error(
        `Seed refused: departure "${departure.slug}" is flagged priceUnverified but the catalogue no longer flags ` +
          `"${twin.slug}". If the price was confirmed, clear BOTH flags (BLOCKERS.md item 9).`
      );
    }
  }
}

/**
 * Destinations are DERIVED from the records that reference them, not authored
 * separately — there is no destination fixture beyond the 5 international names,
 * and inventing a destination table by hand would be a second source of truth for
 * names that already exist on every tour.
 */
function buildDestinations() {
  const internationalOrder = new Map(internationalDestinations.map((dest, index) => [dest.slug, index]));
  const bySlug = new Map<
    string,
    { slug: string; name: string; photoKey: string; isInternational: boolean; internationalOrder: number | null }
  >();

  const remember = (slug: string, name: string) => {
    if (bySlug.has(slug)) return;
    bySlug.set(slug, {
      slug,
      name,
      // Opaque string key, NOT a URL — Assumption A4. The destination's display
      // name is exactly what `Package.photoUrl` and `Destination.photoUrl` hold
      // today; the card components render a token-coloured placeholder from it.
      photoKey: name,
      isInternational: internationalOrder.has(slug),
      internationalOrder: internationalOrder.get(slug) ?? null,
    });
  };

  for (const tour of allTours) remember(tour.destinationSlug, tour.destinationName);
  // Departures carry only a display name (`GroupDeparture` has no
  // `destinationSlug`), so the FK target is derived through the same `slugify()`
  // both sides already use — it cannot drift from the tour-side slug.
  for (const departure of groupDepartures) remember(slugify(departure.destinationName), departure.destinationName);

  const missing = internationalDestinations.filter((dest) => !bySlug.has(dest.slug));
  if (missing.length > 0) {
    throw new Error(
      `Seed refused: international destination(s) ${missing.map((d) => d.slug).join(', ')} have no tour backing them. ` +
        `A destination card that leads to an empty catalogue is the defect BLOCKERS.md Decision C removed (Malaysia).`
    );
  }

  return Array.from(bySlug.values());
}

/**
 * Prisma's interactive-transaction defaults (`maxWait` 2s, `timeout` 5s) are sized
 * for a database on localhost. This seed issues 12+ sequential statements, and
 * against the DEPLOYED database — reached over a TCP proxy rather than a loopback
 * socket — the per-statement round trip is large enough that the whole batch
 * overruns the 5s budget. Prisma then closes the transaction underneath the seed
 * and the next call fails with `P2028 Transaction not found`, which reads like a
 * connection bug but is purely a timeout.
 *
 * Found by the first live run against the deployed database; it cannot reproduce
 * against localhost or against the mocked client the adapter unit tests use.
 *
 * Raising the budget does NOT weaken the all-or-nothing guarantee — the whole
 * wipe-and-reseed stays in one transaction, which is what stops a failure halfway
 * through from leaving the catalogue partially deleted. `maxWait` covers the
 * initial wait for a pool connection over the same slow link.
 */
const TRANSACTION_OPTIONS = { maxWait: 15_000, timeout: 120_000 } as const;

async function main() {
  assertSafetyFlagsAgree();

  const destinations = buildDestinations();
  const popularOrderBySlug = new Map(popularPackages.map((tour, index) => [tour.slug, index]));

  await prisma.$transaction(async (tx) => {
    // Reverse FK order. `RailTour`/`Brochure` cascade from their parents, but
    // deleting them explicitly keeps this readable and independent of the
    // schema's cascade rules.
    await tx.brochure.deleteMany();
    await tx.railTour.deleteMany();
    await tx.rail.deleteMany();
    await tx.groupDeparture.deleteMany();
    await tx.tour.deleteMany();
    await tx.destination.deleteMany();

    await tx.destination.createMany({ data: destinations });

    await tx.tour.createMany({
      data: allTours.map((tour, index) => ({
        slug: tour.slug,
        name: tour.name,
        destinationSlug: tour.destinationSlug,
        category: CATEGORY_TO_PRISMA[tour.category],
        durationLabel: tour.durationLabel,
        subtitle: tour.subtitle,
        photoKey: tour.photoUrl,
        photosCount: tour.photosCount,
        priceFrom: tour.priceFrom,
        priceWas: tour.priceWas ?? null,
        savingsLabel: tour.savingsLabel ?? null,
        seatsLabel: tour.seatsLabel ?? null,
        isHot: tour.isHot ?? false,
        // The safety flag crosses into the database as a real column. The
        // adapter enforces it on read; this preserves it on write.
        pricingUnverified: tour.pricingUnverified ?? false,
        // `allTours` is rail order followed by the popular-only tours. SQL has no
        // inherent row order, so the authored sequence is stored explicitly.
        catalogueOrder: index,
        popularOrder: popularOrderBySlug.get(tour.slug) ?? null,
      })),
    });

    await tx.rail.createMany({
      data: packageRails.map((rail, index) => ({
        slug: slugify(rail.title),
        title: rail.title,
        sortOrder: index,
      })),
    });

    await tx.railTour.createMany({
      data: packageRails.flatMap((rail) =>
        rail.items.map((tour, index) => ({
          railSlug: slugify(rail.title),
          tourSlug: tour.slug,
          sortOrder: index,
        }))
      ),
    });

    await tx.groupDeparture.createMany({
      data: groupDepartures.map((departure, index) => ({
        slug: departure.slug,
        name: departure.name,
        destinationSlug: slugify(departure.destinationName),
        category: CATEGORY_TO_PRISMA[departure.category],
        photoKey: departure.photoUrl,
        dateRangeLabel: departure.dateRangeLabel,
        month: departure.month,
        durationLabel: departure.durationLabel,
        boardingPoints: departure.boardingPoints,
        tourManagerLabel: departure.tourManagerLabel,
        priceFrom: departure.priceFrom,
        seatsLabel: departure.seatsLabel,
        scriptAccent: departure.scriptAccent,
        // Both safety flags carried across as real columns.
        durationUnverified: departure.durationUnverified ?? false,
        priceUnverified: departure.priceUnverified ?? false,
        sortOrder: index,
        // NOTE: no `isSoldOut` column — it is derived from `seatsLabel` on read
        // (`src/content/sold-out.ts`) so the two cannot contradict each other.
      })),
    });

    /**
     * Brochure metadata — the only NEW content in this seed, and every derived
     * field comes from something the tour already really has:
     *
     *   title            ← tour.name        (verbatim, no invented copy)
     *   itinerarySummary ← tour.subtitle    ("Shimla - Kaza - Chandratal")
     *   coverImageKey    ← tour.photoUrl    (opaque token, not a URL)
     *   category         ← tour.category
     *
     * And every field that would require an asset or a fact nobody has is left
     * NULL rather than filled in plausibly:
     *
     *   pdfUrl         NULL — no brochure PDF exists anywhere in this project.
     *                  A synthesised `/brochures/<slug>.pdf` would look real,
     *                  404 on click, and repeat the "▶ Watch Full Video" button
     *                  with no video defect
     *                  (memory/feedback_qg_export-verbatim-false-copy.md).
     *   dateRangeLabel NULL — tours carry no dates in ANY source. Only
     *                  departures do, and borrowing one would invent a validity
     *                  window.
     *   fileSizeBytes  NULL, uploadedAt NULL, downloadCount 0 — no file, no
     *                  upload, no downloads. Not "0 as a placeholder": zero
     *                  downloads is the true count.
     *   priceLabel     NULL for every `pricingUnverified` tour. The catalogue
     *                  withholds those prices; a brochure row is not a loophole
     *                  around the gate.
     *
     * `status` is PENDING_UPLOAD on every row, which is what makes the NULL
     * `pdfUrl` legible to a consumer as "not ready" rather than "data missing".
     */
    await tx.brochure.createMany({
      data: allTours.map((tour) => ({
        tourSlug: tour.slug,
        title: tour.name,
        itinerarySummary: tour.subtitle,
        priceLabel: tour.pricingUnverified ? null : tour.priceFrom,
        dateRangeLabel: null,
        coverImageKey: tour.photoUrl,
        category: CATEGORY_TO_PRISMA[tour.category],
        pdfUrl: null,
        status: 'PENDING_UPLOAD' as const,
        version: 1,
        fileSizeBytes: null,
        downloadCount: 0,
        uploadedAt: null,
      })),
    });
  }, TRANSACTION_OPTIONS);

  const flaggedTours = allTours.filter((tour) => tour.pricingUnverified).length;
  const flaggedDepartures = groupDepartures.filter((d) => d.priceUnverified || d.durationUnverified).length;

  console.log(
    [
      'Seeded the interim content database (BLOCKERS.md §5):',
      `  destinations      ${destinations.length}`,
      `  tours             ${allTours.length}  (${flaggedTours} withheld from public listings: pricingUnverified)`,
      `  rails             ${packageRails.length}`,
      `  group departures  ${groupDepartures.length}  (${flaggedDepartures} carrying an unverified-data marker)`,
      `  brochures         ${allTours.length}  (all PENDING_UPLOAD, pdfUrl NULL — no real PDFs exist)`,
    ].join('\n')
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

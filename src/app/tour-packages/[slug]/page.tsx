import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { getTourBySlug } from '@/server/crm/client';
import { SiteShell } from '@/components/layout/SiteShell';
import { PhotoPlaceholder } from '@/components/ui/photo-placeholder';
import { PriceOnRequest } from '@/components/ui/price-on-request';
import { isSafeMediaUrl } from '@/lib/cloudinary-url';
import { formatTourDuration } from '@/lib/duration';
import { formatCrmPrice } from '@/lib/rupees';
import { PackageDetailCtas } from '@/components/tour-packages/PackageDetailCtas';

interface PackageDetailPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * CRM-migration Step 2: no more `generateStaticParams()`. The old build-time
 * SSG model enumerated every tour from the database at build time; the CRM
 * is now the single source of truth and can add/remove/retire a tour
 * without a redeploy, so every slug is resolved on demand through
 * `getTourBySlug()` (cached/tagged for 60s via Next's fetch cache, same as
 * every other CRM read) and `dynamicParams` stays at its default `true`.
 */
export async function generateMetadata({ params }: PackageDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getTourBySlug(slug);
  if (result.status !== 'found') return {};
  return {
    title: result.tour.seoTitle || result.tour.name,
    description: result.tour.seoDescription || result.tour.shortDescription,
  };
}

/**
 * `/tour-packages/[slug]` — Server Component.
 *
 * Three outcomes, matching the contract exactly:
 *  - `found` → render the full detail;
 *  - `redirect` → the slug is retired but the tour still exists; issue the
 *    website's OWN redirect (the contract is explicit that the CRM's `200`
 *    body is not itself a redirect);
 *  - `not-found` → `notFound()`, identical to a tour that never existed —
 *    the CRM's own design rule is that withheld/retired/absent are never
 *    distinguishable to a caller.
 */
export default async function PackageDetailPage({ params }: PackageDetailPageProps) {
  const { slug } = await params;
  const result = await getTourBySlug(slug);

  if (result.status === 'not-found') notFound();
  if (result.status === 'redirect') redirect(`/tour-packages/${result.redirectTo}`);

  const tour = result.tour;
  const priceLabel = formatCrmPrice(tour.price);
  const durationLabel = formatTourDuration(tour.durationDays, tour.durationNights);
  const galleryUrls = tour.gallery.filter((image) => isSafeMediaUrl(image.url));

  return (
    <SiteShell activePath="/tour-packages" pageLabel={tour.name}>
      <div className="mx-auto flex max-w-[900px] flex-col gap-6 px-gx py-8">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-[6px] text-13 text-gty-subtle">
          <Link href="/" className="transition-colors duration-gty-fast ease-gty hover:text-gty-primary">
            Home
          </Link>
          <span aria-hidden="true">/</span>
          <Link href="/tour-packages" className="transition-colors duration-gty-fast ease-gty hover:text-gty-primary">
            Tour Packages
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="text-gty-ink-soft">
            {tour.name}
          </span>
        </nav>

        <PhotoPlaceholder
          photoKey={tour.name}
          imageUrl={tour.coverImageUrl}
          alt={`${tour.name} — ${tour.primaryPlace.name}`}
          className="h-[280px] w-full rounded-18 760:h-[380px]"
        />

        {galleryUrls.length > 0 && (
          <section aria-labelledby="tour-gallery-heading" className="flex flex-col gap-3">
            <h2 id="tour-gallery-heading" className="text-16 font-extrabold text-gty-ink">
              Photos
            </h2>
            <ul className="flex flex-wrap gap-3">
              {galleryUrls.map((image, index) => (
                <li key={image.url}>
                  <a
                    href={image.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-12 border border-gty-border transition-transform duration-gty-fast ease-gty hover:-translate-y-[2px]"
                  >
                    <PhotoPlaceholder
                      photoKey={tour.name}
                      imageUrl={image.url}
                      alt={image.alt || `${tour.name} — photo ${index + 1} of ${galleryUrls.length}`}
                      className="h-[110px] w-[150px]"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex flex-wrap items-center gap-[10px]">
          <span className="inline-flex items-center gap-[6px] rounded-pill bg-gty-red-150 px-3 py-[6px] text-12-5 font-semibold text-gty-primary">
            {tour.category}
          </span>
        </div>

        <h1 className="text-29 font-extrabold leading-[1.15] tracking-tightest text-gty-ink 760:text-36">{tour.name}</h1>

        <p className="flex items-center gap-[7px] text-14 text-gty-body">
          <span aria-hidden="true" className="text-gty-subtle">
            ⏱
          </span>
          {durationLabel}
        </p>
        <p className="text-15 leading-[1.5] text-gty-body">{tour.description || tour.shortDescription}</p>

        <div className="h-px bg-gty-border-4" />

        {/* A single GST-inclusive price, or the per-tier prices if the CRM has configured any — never a struck-through "was" price or a "Save ₹X" badge, which this contract has no field for. */}
        {tour.pricingOptions.length > 0 ? (
          <div className="flex flex-col gap-3">
            <h2 className="text-16 font-extrabold text-gty-ink">Pricing</h2>
            <ul className="flex flex-wrap gap-3">
              {tour.pricingOptions.map((option) => {
                const optionPrice = formatCrmPrice(option.price);
                return (
                  <li
                    key={option.label}
                    className="flex min-w-[180px] flex-col gap-1 rounded-14 border border-gty-border bg-gty-surface-3 px-4 py-3"
                  >
                    <span className="text-13 font-bold text-gty-ink">{option.label}</span>
                    <span className="text-20 font-extrabold text-gty-primary">
                      {optionPrice ?? <PriceOnRequest interactive={false} />}
                    </span>
                    {option.note && <span className="text-11-5 text-gty-subtle">{option.note}</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : priceLabel ? (
          <span className="text-29 font-extrabold text-gty-primary">{priceLabel}</span>
        ) : (
          <PriceOnRequest />
        )}

        {tour.highlights.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-16 font-extrabold text-gty-ink">Highlights</h2>
            <ul className="flex flex-col gap-[6px] text-14 text-gty-body">
              {tour.highlights.map((highlight) => (
                <li key={highlight} className="flex gap-2">
                  <span aria-hidden="true" className="text-gty-primary">
                    ✓
                  </span>
                  {highlight}
                </li>
              ))}
            </ul>
          </section>
        )}

        {tour.itinerary.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-16 font-extrabold text-gty-ink">Itinerary</h2>
            <ol className="flex flex-col gap-3">
              {tour.itinerary.map((day) => (
                <li key={day.day} className="rounded-14 border border-gty-border bg-gty-surface-3 px-4 py-3">
                  <p className="text-13 font-bold text-gty-ink">
                    Day {day.day}: {day.title}
                  </p>
                  <p className="text-13-5 text-gty-body">{day.detail}</p>
                </li>
              ))}
            </ol>
          </section>
        )}

        {(tour.inclusions.length > 0 || tour.exclusions.length > 0) && (
          <section className="grid gap-6 760:grid-cols-2">
            {tour.inclusions.length > 0 && (
              <div className="flex flex-col gap-2">
                <h2 className="text-16 font-extrabold text-gty-ink">Inclusions</h2>
                <ul className="flex flex-col gap-[6px] text-13-5 text-gty-body">
                  {tour.inclusions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {tour.exclusions.length > 0 && (
              <div className="flex flex-col gap-2">
                <h2 className="text-16 font-extrabold text-gty-ink">Exclusions</h2>
                <ul className="flex flex-col gap-[6px] text-13-5 text-gty-body">
                  {tour.exclusions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {tour.departures.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-16 font-extrabold text-gty-ink">Upcoming departures</h2>
            <ul className="flex flex-wrap gap-3">
              {tour.departures.map((departure) => (
                <li
                  key={departure.date}
                  className="flex min-w-[160px] flex-col gap-1 rounded-14 border border-gty-border bg-gty-surface-3 px-4 py-3"
                >
                  <span className="text-13 font-bold text-gty-ink">{departure.date}</span>
                  <span className="text-12-5 text-gty-body">
                    {departure.soldOut ? 'Sold out' : `${departure.seatsLeft} seats left`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {tour.cancellationPolicy && (
          <section className="flex flex-col gap-2">
            <h2 className="text-16 font-extrabold text-gty-ink">Cancellation Policy</h2>
            <p className="text-13-5 leading-[1.6] text-gty-body">{tour.cancellationPolicy}</p>
          </section>
        )}

        <PackageDetailCtas packageName={tour.name} slug={tour.slug} hasBrochure={tour.hasBrochure} />
      </div>
    </SiteShell>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getAllPackages, getPackageBySlug } from '@/content/get-all-packages';
import { SiteShell } from '@/components/layout/SiteShell';
import { PhotoPlaceholder } from '@/components/ui/photo-placeholder';
import { PriceOnRequest } from '@/components/ui/price-on-request';
import { isSafeMediaUrl } from '@/lib/cloudinary-url';
import { hasConfirmedTourPrice } from '@/lib/rupees';
import { PackageDetailCtas } from '@/components/tour-packages/PackageDetailCtas';

interface PackageDetailPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * BLOCKERS.md Decision D. Static params cover every `Package` a `PackageCard`
 * can link to site-wide — see `getAllPackages()` for why this is not just the
 * 20 `packageRails` items.
 */
export async function generateStaticParams() {
  const packages = await getAllPackages();
  return packages.map((pkg) => ({ slug: pkg.slug }));
}

export async function generateMetadata({ params }: PackageDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const pkg = await getPackageBySlug(slug);
  if (!pkg) {
    return {};
  }
  return {
    title: pkg.name,
    description: `${pkg.durationLabel} · ${pkg.subtitle}`,
  };
}

/**
 * `/tour-packages/[slug]` — Server Component, BLOCKERS.md Decision D.
 * Renders ONLY fields that exist on the `Package` type/fixtures: photo,
 * name, destination, category, duration, subtitle/route, photo count,
 * price, "was" price, savings. No day-by-day itinerary, inclusions/
 * exclusions, hotels, maps or reviews — the export's own detail screen
 * renders those from `PACKS[0]` regardless of which card was clicked (not
 * real per-tour data), so none of it is transcribed here.
 */
export default async function PackageDetailPage({ params }: PackageDetailPageProps) {
  const { slug } = await params;
  const pkg = await getPackageBySlug(slug);

  if (!pkg) {
    notFound();
  }

  // The record's own display name ("Leh Ladakh"), not a de-slugified guess
  // ("leh ladakh" / "vaishnodevi").
  const destinationName = pkg.destinationName;

  /**
   * THE GALLERY URLs ARE FILTERED BEFORE THEY REACH AN `href`.
   *
   * `PhotoPlaceholder` already refuses an unsafe `src`, but this page also puts
   * each URL in an anchor, and an anchor is the more dangerous of the two: a
   * `javascript:` `src` on an `<img>` does nothing in any current browser, while
   * a `javascript:` `href` is one click from executing on our origin, in the
   * visitor's session.
   *
   * Nothing writable through the admin can get here — `cloudinaryUrl` in the
   * tour schema pins the host. But this column is also reachable by a direct SQL
   * edit, by a restore of a backup predating that rule, and by any future import
   * script, and a renderer that trusts its datastore is trusting every path that
   * has ever written to it. Filtering (rather than refusing the page) means one
   * bad row costs one thumbnail, not the tour.
   */
  const galleryUrls = (pkg.galleryImageUrls ?? []).filter(isSafeMediaUrl);

  /**
   * CRM-migration decision 1: the public-listing gate no longer withholds a
   * tour for an unconfirmed price, so this page may now render a tour whose
   * `priceFrom` is missing/zero — never show "₹0" or a blank figure for
   * that, and never a "Save ₹X" badge with no real price beside it.
   */
  const priceConfirmed = hasConfirmedTourPrice(pkg.priceFrom);

  return (
    <SiteShell activePath="/tour-packages" pageLabel={pkg.name}>
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
            {pkg.name}
          </span>
        </nav>

        <PhotoPlaceholder
          photoKey={pkg.photoUrl}
          imageUrl={pkg.coverImageUrl}
          alt={`${pkg.name} — ${destinationName}`}
          className="h-[280px] w-full rounded-18 760:h-[380px]"
        />

        {/*
          The gallery, when the tour has one — Phase C.

          Rendered here rather than left as admin-only data on purpose. The badge
          two elements below says "{photosCount} Photos", and `photosCount` is now
          derived from this very gallery, so without somewhere to see them the
          page would promise photographs and provide no way to reach them —
          the "flag that renders but leads nowhere" shape
          `memory/feedback_qg_unenforced-safety-flag.md` catalogues.

          A strip of links to the full-size images, not a lightbox. A lightbox is
          a real component with focus management and keyboard handling, and half
          of one is worse than none; opening the image is something every browser
          already does correctly.
        */}
        {galleryUrls.length > 0 && (
          <section aria-labelledby="tour-gallery-heading" className="flex flex-col gap-3">
            <h2 id="tour-gallery-heading" className="text-16 font-extrabold text-gty-ink">
              Photos
            </h2>
            <ul className="flex flex-wrap gap-3">
              {galleryUrls.map((url, index) => (
                <li key={url}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-12 border border-gty-border transition-transform duration-gty-fast ease-gty hover:-translate-y-[2px]"
                  >
                    <PhotoPlaceholder
                      photoKey={pkg.photoUrl}
                      imageUrl={url}
                      alt={`${pkg.name} — photo ${index + 1} of ${galleryUrls.length}`}
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
            {pkg.category}
          </span>
          <span className="inline-flex items-center gap-[6px] rounded-8 bg-gty-overlay-dark px-[10px] py-[5px] text-12 font-semibold text-gty-white">
            {pkg.photosCount} Photos
          </span>
        </div>

        <h1 className="text-29 font-extrabold leading-[1.15] tracking-tightest text-gty-ink 760:text-36">{pkg.name}</h1>

        <p className="flex items-center gap-[7px] text-14 text-gty-body">
          <span aria-hidden="true" className="text-gty-subtle">
            ⏱
          </span>
          {pkg.durationLabel}
        </p>
        <p className="text-15 leading-[1.5] text-gty-body">{pkg.subtitle}</p>

        <div className="h-px bg-gty-border-4" />

        <div className="flex flex-wrap items-center gap-4">
          {priceConfirmed ? (
            <>
              {pkg.savingsLabel && (
                <span className="inline-flex items-center gap-[7px] rounded-9 border border-gty-green-border bg-gty-green-bg px-[13px] py-[7px] text-13-5 font-bold text-gty-green-text">
                  Save ₹{pkg.savingsLabel}
                </span>
              )}
              <span className="flex items-baseline gap-[9px]">
                <span className="text-29 font-extrabold text-gty-primary">{pkg.priceFrom}</span>
                {pkg.priceWas && <span className="text-16 text-gty-faint line-through">{pkg.priceWas}</span>}
              </span>
            </>
          ) : (
            <PriceOnRequest />
          )}
        </div>

        <PackageDetailCtas packageName={pkg.name} />
      </div>
    </SiteShell>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getAllPackages, getPackageBySlug } from '@/content/get-all-packages';
import { SiteShell } from '@/components/layout/SiteShell';
import { PhotoPlaceholder } from '@/components/ui/photo-placeholder';
import { PackageDetailCtas } from '@/components/tour-packages/PackageDetailCtas';

interface PackageDetailPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * BLOCKERS.md Decision D. Static params cover the UNION of every `Package`
 * a `PackageCard` can link to site-wide — see `getAllPackages()` for why
 * this is not just the 20 `packageRails` items.
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

  const destinationName = pkg.destinationSlug.replace(/-/g, ' ');

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
          alt={`${pkg.name} — ${destinationName}`}
          className="h-[280px] w-full rounded-18 760:h-[380px]"
        />

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
          {pkg.savingsLabel && (
            <span className="inline-flex items-center gap-[7px] rounded-9 border border-gty-green-border bg-gty-green-bg px-[13px] py-[7px] text-13-5 font-bold text-gty-green-text">
              Save ₹{pkg.savingsLabel}
            </span>
          )}
          <span className="flex items-baseline gap-[9px]">
            <span className="text-29 font-extrabold text-gty-primary">{pkg.priceFrom}</span>
            {pkg.priceWas && <span className="text-16 text-gty-faint line-through">{pkg.priceWas}</span>}
          </span>
        </div>

        <PackageDetailCtas packageName={pkg.name} />
      </div>
    </SiteShell>
  );
}

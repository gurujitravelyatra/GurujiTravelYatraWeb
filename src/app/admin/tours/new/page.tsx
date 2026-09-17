import type { Metadata } from 'next';
import Link from 'next/link';

import { requireAdminSession } from '@/server/auth/session';
import { listDestinationOptions } from '@/server/admin/tours/tour-repository';
import { TourForm } from '@/components/admin/TourForm';

export const metadata: Metadata = {
  title: 'New tour',
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = 'force-dynamic';

/**
 * `/admin/tours/new`.
 *
 * A new tour is created as a DRAFT unless the admin presses Publish — the
 * `status` column's default and `statusForIntent()` agree on that, from two
 * directions, so a create path that somehow omitted the status would still not
 * produce a live tour.
 */
export default async function NewTourPage() {
  await requireAdminSession();

  const destinations = await listDestinationOptions();

  return (
    <main className="mx-auto w-full max-w-[860px] px-5 py-12 860:px-8">
      <header className="mb-8 flex flex-col gap-2 border-b border-gty-border pb-6">
        <Link
          href="/admin/tours"
          className="text-11-5 font-bold uppercase tracking-label text-gty-subtle transition-colors duration-gty-fast ease-gty hover:text-gty-primary"
        >
          ← Tours
        </Link>
        <h1 className="text-26 font-extrabold leading-tight text-gty-ink">New tour</h1>
      </header>

      {!destinations.configured ? (
        <p role="status" className="rounded-18 border border-gty-border bg-gty-white px-6 py-8 text-14 text-gty-body">
          No content database is configured, so tours cannot be created here.
        </p>
      ) : (
        <TourForm
          destinations={destinations.value}
          defaultValues={{
            name: '',
            slug: '',
            destinationSlug: '',
            category: 'Spiritual',
            audienceTags: [],
            isHot: false,
            inclusions: [],
            exclusions: [],
            itineraryDays: [],
            faqs: [],
            pricingTiers: [],
          }}
        />
      )}
    </main>
  );
}

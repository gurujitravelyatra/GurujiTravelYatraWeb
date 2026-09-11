import Link from 'next/link';

import { PhotoPlaceholder } from '@/components/ui/photo-placeholder';

/**
 * Export lines 343-352, tech spec §4.4 "Tour Packages" row 1.
 *
 * COPY FIDELITY: the export's subheading promised "easy filters and real-time
 * availability". There is no availability data anywhere in the system — no
 * departure dates, no seat counts (`Package.seatsLabel` exists on the type but
 * no record sets it), and no live source to read either from. The phrase is
 * removed rather than softened; "easy filters" is true (the category chip row
 * and the destination select both filter for real). Enforced by
 * `__tests__/tour-packages-copy.test.tsx`, which scans this whole page's
 * rendered copy — not just the fixture files.
 */
export function TourPackagesHero() {
  return (
    <div
      className="relative overflow-hidden px-gx pb-24 pt-[26px]"
      style={{ background: 'linear-gradient(180deg,#faf8f7 0%,#f7f4f2 100%)' }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-[56%] opacity-50 1080:block"
        style={{
          WebkitMaskImage: 'linear-gradient(90deg,rgba(0,0,0,0) 0%,rgba(0,0,0,.55) 26%,#000 62%)',
          maskImage: 'linear-gradient(90deg,rgba(0,0,0,0) 0%,rgba(0,0,0,.55) 26%,#000 62%)',
        }}
      >
        <PhotoPlaceholder photoKey="Himalaya" alt="" className="h-full w-full items-start justify-end p-4 text-right" />
      </div>
      <p
        aria-hidden="true"
        className="pointer-events-none absolute left-[34%] top-[14px] hidden -rotate-[7deg] font-script text-33 leading-[1.12] text-gty-body 1080:block"
      >
        Explore
        <br />
        <span className="pl-3">Plan</span>
        <br />
        <span className="pl-[26px]">Travel</span>
        <br />
        <span className="pl-10">Repeat</span>
        <span className="ml-[42px] mt-[2px] block h-[2px] w-[120px] rounded-[2px] bg-gty-primary" />
      </p>
      <p
        aria-hidden="true"
        className="pointer-events-none absolute right-[calc(var(--gx)-8px)] top-[34px] hidden rotate-[4deg] text-right font-script text-29 leading-[1.1] text-gty-white 1080:block"
        style={{ textShadow: '0 2px 10px rgba(0,0,0,.45)' }}
      >
        Good
        <br />
        Trips
        <br />
        Brighter
        <br />
        Lives
      </p>

      <div className="relative z-[2] flex max-w-[640px] flex-col gap-3">
        <nav aria-label="Breadcrumb" className="flex items-center gap-[6px] text-13 text-gty-subtle">
          <Link href="/" className="transition-colors duration-gty-fast ease-gty hover:text-gty-primary">
            Home
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="text-gty-ink-soft">
            Tour Packages
          </span>
        </nav>
        <h1 className="text-36 font-extrabold tracking-tighter text-gty-ink 760:text-52">
          Tour <span className="text-gty-primary">Packages</span>
        </h1>
        <p className="max-w-[520px] text-14 leading-[1.6] text-gty-body 760:text-15-5">
          Discover handpicked journeys to the most beautiful destinations.
          <br className="hidden 760:block" />
          Find your perfect trip with easy filters.
        </p>
      </div>
    </div>
  );
}

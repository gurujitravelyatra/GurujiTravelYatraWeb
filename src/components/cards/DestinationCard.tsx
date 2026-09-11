import Link from 'next/link';

import type { Destination } from '@/content/types';
import { PhotoPlaceholder } from '@/components/ui/photo-placeholder';

export interface DestinationCardProps {
  destination: Destination;
}

/**
 * `.intlcard` — export lines 229-234. The minimal card used only for Home's
 * International Destinations rail: full-bleed photo, dark gradient overlay,
 * centered name near the top. No price/heart/category — a card that renders
 * any of those is a `PackageCard`, not this component (tech spec §4.3).
 *
 * 252×380 desktop, 196×296 ≤760px (export media rule) — reused later on the
 * out-of-scope `/destinations` page, so it is its own component now.
 *
 * Every card used to link to the bare, unfiltered `/tour-packages`: clicking
 * "Maldives" and clicking "Dubai" produced the identical page, so the card
 * behaved as decoration rather than navigation. It now deep-links to the
 * destination-filtered catalogue. `international.fixture.ts` is kept in sync
 * with the tour data (and Malaysia removed) precisely so this link can never
 * land on "No journeys match this filter yet."
 */
export function DestinationCard({ destination }: DestinationCardProps) {
  return (
    <Link
      href={`/tour-packages?destination=${encodeURIComponent(destination.slug)}`}
      className="relative block h-[296px] w-[196px] flex-none overflow-hidden rounded-20 shadow-gty-intl transition-[box-shadow,transform] duration-gty-card ease-gty hover:-translate-y-1 hover:shadow-gty-intl-hover 760:h-[380px] 760:w-[252px]"
    >
      <PhotoPlaceholder photoKey={destination.photoUrl} alt={destination.name} className="absolute inset-0 h-full w-full items-start p-0" />
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.42)_0%,rgba(0,0,0,.05)_42%,rgba(0,0,0,.30)_100%)]"
      />
      <span className="absolute inset-x-0 top-[34px] text-center text-26 font-extrabold tracking-tiny text-gty-white [text-shadow:0_3px_14px_rgba(0,0,0,.5)]">
        {destination.name}
      </span>
    </Link>
  );
}

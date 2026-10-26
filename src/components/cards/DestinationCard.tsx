import Link from 'next/link';

import type { CrmPlace } from '@/server/crm/types';
import { PhotoPlaceholder } from '@/components/ui/photo-placeholder';

export interface DestinationCardProps {
  place: CrmPlace;
}

/**
 * `.intlcard` — the minimal card used for Home's destinations rail: full-bleed
 * photo, dark gradient overlay, centered name near the top. No price/heart/
 * category — a card that renders any of those is a `PackageCard`, not this
 * component.
 *
 * Deep-links to `?place=<slug>` — the CRM contract's actual query-param name
 * for `GET /public/tours` (the old `?destination=` name is gone with the old
 * content layer).
 */
export function DestinationCard({ place }: DestinationCardProps) {
  return (
    <Link
      href={`/tour-packages?place=${encodeURIComponent(place.slug)}`}
      className="relative block h-[296px] w-[196px] flex-none overflow-hidden rounded-20 shadow-gty-intl transition-[box-shadow,transform] duration-gty-card ease-gty hover:-translate-y-1 hover:shadow-gty-intl-hover 760:h-[380px] 760:w-[252px]"
    >
      <PhotoPlaceholder
        photoKey={place.name}
        imageUrl={place.imageUrl}
        alt={place.name}
        className="absolute inset-0 h-full w-full items-start p-0"
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.42)_0%,rgba(0,0,0,.05)_42%,rgba(0,0,0,.30)_100%)]"
      />
      <span className="absolute inset-x-0 top-[34px] text-center text-26 font-extrabold tracking-tiny text-gty-white [text-shadow:0_3px_14px_rgba(0,0,0,.5)]">
        {place.name}
      </span>
    </Link>
  );
}

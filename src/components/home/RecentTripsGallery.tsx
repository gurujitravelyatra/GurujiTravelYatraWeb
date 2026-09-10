'use client';

import { useState } from 'react';

import type { RecentTripPlaceholder } from '@/content/fixtures/recent-trips.fixture';
import { PhotoPlaceholder } from '@/components/ui/photo-placeholder';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog';

export interface RecentTripsGalleryProps {
  trips: RecentTripPlaceholder[];
}

/**
 * [TOKENS] — no design reference exists for this section (tech spec §4.4
 * row 9); flagged for design QA before merge (Open Question Q1). Built with
 * the same horizontal-scroll-row mechanics as the International
 * Destinations rail, plus a lightbox-on-click using the existing Radix
 * Dialog primitives (not `ModalShell`, which is specific to the lead-form
 * chrome). Content is deliberately obvious placeholder — see
 * recent-trips.fixture.ts.
 */
export function RecentTripsGallery({ trips }: RecentTripsGalleryProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const openTrip = openIndex === null ? null : trips[openIndex];

  return (
    <section data-testid="section-9-recent-trips" className="flex flex-col gap-4 border-t border-gty-border-6 px-gx py-[26px]">
      {/* [TOKENS] no design reference — flag for design QA */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-24 font-extrabold tracking-tightest text-gty-ink">Recent Trips</h2>
        <span className="rounded-pill bg-gty-surface-3 px-3 py-1 text-10 font-bold uppercase tracking-label text-gty-subtle">
          Placeholder gallery
        </span>
      </div>

      <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
        {trips.map((trip, index) => (
          <button
            key={trip.photoKey}
            type="button"
            onClick={() => setOpenIndex(index)}
            aria-label={`Open ${trip.caption}`}
            className="flex-none rounded-14 transition-transform duration-gty-card ease-gty hover:-translate-y-1"
          >
            <PhotoPlaceholder photoKey={trip.photoKey} alt={trip.caption} className="h-[150px] w-[220px] rounded-14 border-[1.5px] border-dashed border-gty-border-8" />
          </button>
        ))}
      </div>

      <Dialog open={openTrip !== null} onOpenChange={(next) => !next && setOpenIndex(null)}>
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-[60] bg-[rgba(28,26,25,0.55)]" />
          <DialogContent className="fixed left-1/2 top-1/2 z-[60] w-[min(90vw,640px)] -translate-x-1/2 -translate-y-1/2 rounded-18 bg-gty-white p-4 shadow-gty-modal focus:outline-none relative">
            <DialogTitle className="sr-only">Recent trip photo</DialogTitle>
            <DialogDescription className="sr-only">Placeholder recent trip photo lightbox</DialogDescription>
            <DialogClose
              aria-label="Close"
              className="absolute right-3 top-3 text-16 text-gty-subtle transition-colors duration-gty-fast ease-gty hover:text-gty-primary"
            >
              ×
            </DialogClose>
            {openTrip && (
              <>
                <PhotoPlaceholder photoKey={openTrip.photoKey} alt={openTrip.caption} className="h-[50vh] w-full rounded-14" />
                <p className="mt-3 text-12 italic text-gty-subtle">{openTrip.caption}</p>
              </>
            )}
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </section>
  );
}

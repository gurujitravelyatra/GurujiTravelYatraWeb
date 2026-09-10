import type { Review } from '@/content/types';
import { PhotoPlaceholder } from '@/components/ui/photo-placeholder';
import { cn } from '@/lib/utils';

export interface ReviewCardProps {
  review: Review;
}

/**
 * Vertical composition per product-spec §4: trip photo top half, star
 * rating + short quote + traveller name bottom half. No pixel reference
 * exists for this card in the design export (BLOCKERS.md Decision H notes
 * testimonials have no source data at all) — built from the established
 * token/component vocabulary.
 *
 * Placeholder entries (`isPlaceholder: true`, see testimonials.fixture.ts)
 * are rendered plainly and visibly marked as placeholders — never styled to
 * look like a real customer review.
 */
export function ReviewCard({ review }: ReviewCardProps) {
  const stars = Math.round(review.ratingOutOf5);

  return (
    <div
      className={cn(
        'flex w-full max-w-[360px] flex-col overflow-hidden rounded-18 bg-gty-white shadow-gty-card',
        review.isPlaceholder && 'border-[1.5px] border-dashed border-gty-border-8'
      )}
    >
      <PhotoPlaceholder
        photoKey={review.photoUrl}
        alt={review.isPlaceholder ? 'Placeholder traveller photo' : `${review.travellerName} — ${review.tripLabel}`}
        className="h-[180px] w-full"
      />
      <div className="flex flex-col gap-2 p-5">
        <div className="flex items-center gap-1" role="img" aria-label={`Rated ${stars} out of 5 stars`}>
          {Array.from({ length: 5 }).map((_, index) => (
            <span key={index} aria-hidden="true" className={index < stars ? 'text-gty-gold-deep' : 'text-gty-border-3'}>
              ★
            </span>
          ))}
        </div>
        <p className={cn('text-14 leading-relaxed text-gty-body', review.isPlaceholder && 'italic text-gty-subtle')}>
          &#8220;{review.quote}&#8221;
        </p>
        <div className="mt-1 flex flex-col">
          <span className="text-13-5 font-bold text-gty-ink">{review.travellerName}</span>
          <span className="text-12 text-gty-subtle">{review.tripLabel}</span>
        </div>
        {review.isPlaceholder && (
          <span className="mt-1 inline-flex w-fit rounded-pill bg-gty-surface-3 px-3 py-1 text-10 font-bold uppercase tracking-label text-gty-subtle">
            Placeholder
          </span>
        )}
      </div>
    </div>
  );
}

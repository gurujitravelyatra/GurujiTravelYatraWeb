import { cn } from '@/lib/utils';
import { cloudinaryDisplayUrl } from '@/lib/cloudinary-url';

export interface PhotoPlaceholderProps {
  /** Opaque fixture photo key (Assumption A4) — not a URL. */
  photoKey: string;
  /**
   * A REAL uploaded image URL (Cloudinary), when the tour has one. Phase C.
   *
   * When set, this component renders an actual `<img>` and the placeholder box
   * is not rendered at all — including its "Image placeholder" accessible name,
   * which would be a lie about a photo that exists.
   *
   * The branch lives HERE, in the one component every card, hero and rail
   * already routes its image through, rather than at each call site. That is the
   * same composition rule `isPubliclyListable()` follows and for the same
   * reason: every surface inherits the behaviour with no edit and no way to be
   * the one that was forgotten. A sibling `<TourImage>` component would have had
   * to be retro-fitted to each caller, and the caller that got missed would be
   * the one still showing a grey box for a tour whose photo was uploaded weeks
   * ago.
   */
  imageUrl?: string;
  /**
   * What the real photo WILL show. Used as the subject in the accessible
   * name, never as the whole name — see the component doc. Pass `''` for
   * purely decorative surfaces, which then get a generic label.
   */
  alt: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Builds an accessible name that says "placeholder" out loud.
 *
 * Exported for the test that guards it: `aria-label={alt}` announced
 * "Himalayan landscape — Guruji Travel Yatra" for what is, on screen, an empty
 * token-coloured box. A screen-reader user was told the page contained
 * photography that nobody can see because it does not exist.
 */
export function placeholderAriaLabel(alt: string): string {
  const subject = alt.trim();
  return subject.length > 0 ? `Image placeholder — ${subject}` : 'Image placeholder';
}

/**
 * Token-coloured stand-in for a real photo. No Cloudinary account/photo
 * files are confirmed yet (tech spec §4.1 Media, Assumption A4), so every
 * card renders this instead of a broken `next/image`. Mirrors the design
 * export's own `.img` class, which already shows an uppercase label in this
 * exact situation (no resolved background-image) — this is not an invented
 * treatment, it is the export's own fallback visual.
 *
 * The accessible name is prefixed with "Image placeholder" (see
 * `placeholderAriaLabel`) so assistive tech describes the box for what it is
 * rather than describing photography that does not exist. The subject is kept
 * after the prefix because it is still the most useful thing to say about the
 * slot — it just may not be presented as a picture the user is missing out on.
 *
 * ## Phase C resolved the TODO this file used to carry
 *
 * It read: "swap for `next/image` once real photo URLs/a Cloudinary loader are
 * confirmed… at that point the label becomes plain `alt`." Cloudinary is now
 * configured-or-not at runtime and tours can carry a real cover URL, so that is
 * what `imageUrl` does — and the label does become plain `alt`, because the
 * "Image placeholder —" prefix exists to stop a screen reader describing
 * photography that does not exist. When the photo DOES exist, the prefix would
 * be the inaccurate one.
 *
 * The placeholder branch is not going away, and is not dead code: 22 seeded
 * tours have no upload, a draft is saved before the photos are found, and
 * destinations/departures/reviews still have no upload path at all.
 */
export function PhotoPlaceholder({ photoKey, imageUrl, alt, className, children }: PhotoPlaceholderProps) {
  if (imageUrl) {
    return (
      <div className={cn('relative flex items-end overflow-hidden bg-gty-img-bg', className)}>
        {/*
          A plain <img> rather than `next/image`.
          `cloudinaryDisplayUrl` has already asked Cloudinary for a width-capped,
          `q_auto`/`f_auto` derivative — which IS the automatic optimisation
          Cloudinary was chosen for — so routing it through Next's optimiser as
          well would fetch the derived image and derive it again, paying two CDNs
          for one picture. `next/image` would also require every Cloudinary host
          in `next.config.ts`'s `remotePatterns` and would not add a layout
          guarantee here, because the size comes from `className` in every call
          site rather than from intrinsic dimensions.
        */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cloudinaryDisplayUrl(imageUrl, 1200)}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
        {children}
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={placeholderAriaLabel(alt)}
      className={cn('relative flex items-end overflow-hidden bg-gty-img-bg p-3', className)}
    >
      <span aria-hidden="true" className="text-9 font-bold uppercase tracking-img text-gty-subtle">
        {photoKey}
      </span>
      {children}
    </div>
  );
}

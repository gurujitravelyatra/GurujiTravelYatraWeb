import { cn } from '@/lib/utils';

export interface PhotoPlaceholderProps {
  /** Opaque fixture photo key (Assumption A4) — not a URL. */
  photoKey: string;
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
 * TODO(real-photos): swap for `next/image` once real photo URLs/a Cloudinary
 * loader are confirmed. `photoKey` maps 1:1 to what a future adapter would
 * resolve into a real `photoUrl`; at that point the label becomes plain `alt`.
 */
export function PhotoPlaceholder({ photoKey, alt, className, children }: PhotoPlaceholderProps) {
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

import { cn } from '@/lib/utils';

export interface PhotoPlaceholderProps {
  /** Opaque fixture photo key (Assumption A4) — not a URL. */
  photoKey: string;
  alt: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Token-coloured stand-in for a real photo. No Cloudinary account/photo
 * files are confirmed yet (tech spec §4.1 Media, Assumption A4), so every
 * card renders this instead of a broken `next/image`. Mirrors the design
 * export's own `.img` class, which already shows an uppercase label in this
 * exact situation (no resolved background-image) — this is not an invented
 * treatment, it is the export's own fallback visual.
 *
 * TODO(real-photos): swap for `next/image` once real photo URLs/a Cloudinary
 * loader are confirmed. `photoKey` maps 1:1 to what a future adapter would
 * resolve into a real `photoUrl`.
 */
export function PhotoPlaceholder({ photoKey, alt, className, children }: PhotoPlaceholderProps) {
  return (
    <div role="img" aria-label={alt} className={cn('relative flex items-end overflow-hidden bg-gty-img-bg p-3', className)}>
      <span aria-hidden="true" className="text-9 font-bold uppercase tracking-img text-gty-subtle">
        {photoKey}
      </span>
      {children}
    </div>
  );
}

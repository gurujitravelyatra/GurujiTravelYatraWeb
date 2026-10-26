import { PhotoPlaceholder } from '@/components/ui/photo-placeholder';

/**
 * No real Instagram feed integration exists (no API, no CMS-managed tile
 * set) — these are obvious placeholder tiles, never presented as real posts.
 * Inlined here (not read through `@/content/**`, which is the old fixture/
 * database content layer being removed) since this is decorative token data
 * with no CRM source and no reason to live in that doomed directory.
 */
const INSTAGRAM_TILE_KEYS = Array.from({ length: 6 }, (_, index) => `instagram-placeholder-${index + 1}`);

export interface InstagramStripProps {
  /** Resolved from `site.settings.instagramUrl` with a static fallback — see `resolveSiteContact`. */
  instagramUrl: string;
}

/** Pulls the handle out of a `instagram.com/<handle>/` URL for the "@handle" heading, without inventing one if the shape is unexpected. */
function instagramHandleFromUrl(url: string): string {
  const match = /instagram\.com\/([^/]+)/i.exec(url);
  return match ? match[1] : 'gurujitravelyatra';
}

/**
 * [TOKENS] — no design reference exists for this section. No Instagram API
 * integration — tiles are obvious placeholders (see instagram.fixture.ts),
 * but the handle and profile link are real, sourced from the CRM's site
 * settings (with a static fallback until the Owner sets one there).
 */
export function InstagramStrip({ instagramUrl }: InstagramStripProps) {
  const handle = instagramHandleFromUrl(instagramUrl);

  return (
    <section data-testid="section-12-instagram" className="flex flex-col gap-4 border-t border-gty-border-6 px-gx py-[26px]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-24 font-extrabold tracking-tightest text-gty-ink">@{handle}</h2>
        <a
          href={instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-14-5 font-medium text-gty-ink-soft transition-colors duration-gty-fast ease-gty hover:text-gty-primary"
        >
          Follow Our Journey →
        </a>
      </div>

      <div className="grid grid-cols-3 gap-3 640:grid-cols-6">
        {INSTAGRAM_TILE_KEYS.map((key) => (
          <PhotoPlaceholder
            key={key}
            photoKey={key}
            alt="Instagram post"
            className="aspect-square h-auto w-full rounded-14 border-[1.5px] border-dashed border-gty-border-8"
          />
        ))}
      </div>
    </section>
  );
}

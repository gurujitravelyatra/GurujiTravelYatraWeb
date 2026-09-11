import { instagramTilePlaceholders } from '@/content/fixtures/instagram.fixture';
import { PhotoPlaceholder } from '@/components/ui/photo-placeholder';
import { GTY_INSTAGRAM_HANDLE, GTY_INSTAGRAM_URL } from '@/lib/gty-contact';

/**
 * The strip previously showed `@guruji_travel_yatra` — a handle with
 * underscores that appears nowhere in the design export or the source
 * material; it was invented, and pointed at `href="#"`. The confirmed handle
 * (no underscores) and profile URL now come from `@/lib/gty-contact`.
 *
 * [TOKENS] — no design reference exists for this section (tech spec §4.4
 * row 12); flagged for design QA before merge (Open Question Q1). No
 * Instagram API integration this sprint — tiles are obvious placeholders
 * (see instagram.fixture.ts), but the handle and profile link are real.
 */
export function InstagramStrip() {
  return (
    <section data-testid="section-12-instagram" className="flex flex-col gap-4 border-t border-gty-border-6 px-gx py-[26px]">
      {/* [TOKENS] no design reference — flag for design QA */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-24 font-extrabold tracking-tightest text-gty-ink">@{GTY_INSTAGRAM_HANDLE}</h2>
        <a
          href={GTY_INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-14-5 font-medium text-gty-ink-soft transition-colors duration-gty-fast ease-gty hover:text-gty-primary"
        >
          Follow Our Journey →
        </a>
      </div>

      <div className="grid grid-cols-3 gap-3 640:grid-cols-6">
        {instagramTilePlaceholders.map((tile) => (
          <PhotoPlaceholder
            key={tile.photoKey}
            photoKey={tile.photoKey}
            alt="Instagram post"
            className="aspect-square h-auto w-full rounded-14 border-[1.5px] border-dashed border-gty-border-8"
          />
        ))}
      </div>
    </section>
  );
}

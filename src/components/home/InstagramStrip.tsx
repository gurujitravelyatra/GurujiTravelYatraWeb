import { instagramTilePlaceholders } from '@/content/fixtures/instagram.fixture';
import { PhotoPlaceholder } from '@/components/ui/photo-placeholder';

/**
 * [TOKENS] — no design reference exists for this section (tech spec §4.4
 * row 12); flagged for design QA before merge (Open Question Q1). No
 * Instagram API integration this sprint — tiles are obvious placeholders
 * (see instagram.fixture.ts). Link reuses the same unconfirmed-handle
 * placeholder already flagged in the Footer (`TODO(social-links)`).
 */
export function InstagramStrip() {
  return (
    <section data-testid="section-12-instagram" className="flex flex-col gap-4 border-t border-gty-border-6 px-gx py-[26px]">
      {/* [TOKENS] no design reference — flag for design QA */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-24 font-extrabold tracking-tightest text-gty-ink">@guruji_travel_yatra</h2>
        {/* TODO(social-links): real Instagram handle/URL not confirmed — placeholder href. */}
        <a href="#" className="text-14-5 font-medium text-gty-ink-soft transition-colors duration-gty-fast ease-gty hover:text-gty-primary">
          Follow Our Journey →
        </a>
      </div>

      <div className="grid grid-cols-3 gap-3 640:grid-cols-6">
        {instagramTilePlaceholders.map((tile) => (
          <PhotoPlaceholder
            key={tile.photoKey}
            photoKey={tile.photoKey}
            alt="Instagram placeholder tile"
            className="aspect-square h-auto w-full rounded-14 border-[1.5px] border-dashed border-gty-border-8"
          />
        ))}
      </div>
    </section>
  );
}

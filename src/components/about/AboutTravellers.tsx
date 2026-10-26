import { PhotoPlaceholder } from '@/components/ui/photo-placeholder';
import { aboutTravellerPhotoKeys } from '@/lib/about-traveller-photo-keys';

/**
 * Descriptive alt text per fixture key — states the subject the real photo
 * will eventually show (a travel scene, not a named individual), never a
 * fabricated customer identity. Falls back to a generic label for any key
 * not in this map, so the component stays correct if the fixture list
 * changes.
 */
const TRAVELLER_ALT_TEXT: Record<string, string> = {
  Group: 'Travellers on a GTY group tour',
  Himalayas: 'Travellers in the Himalayas',
  Varanasi: 'Travellers in Varanasi',
  'Kashmir Valley': 'Travellers in Kashmir Valley',
};

/**
 * "Our Travellers" strip — design export line 735, product-spec §5.8.
 *
 * These would be photographs of real GTY customers. Unlike a destination or
 * package photo, there is no stock substitute for "a real traveller who
 * hasn't been photographed for this yet" — so every tile renders as a
 * labelled `PhotoPlaceholder`, never a stand-in photo that could be mistaken
 * for an actual customer (BLOCKERS.md Decision H).
 */
export function AboutTravellers() {
  return (
    <section
      data-testid="section-about-travellers"
      className="flex flex-col gap-3 border-t border-gty-border-6 px-gx py-[22px]"
    >
      <p className="text-10 font-bold uppercase tracking-label text-gty-subtle">Our Travellers</p>

      <div className="flex flex-wrap gap-2">
        {aboutTravellerPhotoKeys.map((photoKey) => (
          <PhotoPlaceholder
            key={photoKey}
            photoKey={photoKey}
            alt={TRAVELLER_ALT_TEXT[photoKey] ?? 'GTY traveller'}
            className="h-[130px] min-w-[130px] flex-1 rounded-16"
          />
        ))}
      </div>
    </section>
  );
}

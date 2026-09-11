import { render, screen } from '@testing-library/react';

import { AboutTravellers } from '../AboutTravellers';
import { aboutTravellerPhotoKeys } from '@/content/fixtures/about.fixture';
import { placeholderAriaLabel } from '@/components/ui/photo-placeholder';

/**
 * There is no real photography of GTY customers, and unlike a destination
 * photo there is no stock substitute for "a real traveller" — every tile must
 * render as a labelled placeholder, never a stand-in that could be mistaken
 * for an actual customer (BLOCKERS.md Decision H).
 */
describe('AboutTravellers', () => {
  it('renders a photo placeholder for every fixture key with an accessible name', () => {
    render(<AboutTravellers />);

    expect(aboutTravellerPhotoKeys).toHaveLength(4);
    for (const key of aboutTravellerPhotoKeys) {
      const expectedSubject =
        {
          Group: 'Travellers on a GTY group tour',
          Himalayas: 'Travellers in the Himalayas',
          Varanasi: 'Travellers in Varanasi',
          'Kashmir Valley': 'Travellers in Kashmir Valley',
        }[key] ?? 'GTY traveller';

      expect(screen.getByRole('img', { name: placeholderAriaLabel(expectedSubject) })).toBeInTheDocument();
    }
  });

  it('announces every tile as a placeholder, never as a real photo', () => {
    render(<AboutTravellers />);

    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(aboutTravellerPhotoKeys.length);
    for (const image of images) {
      expect(image.getAttribute('aria-label')).toMatch(/^Image placeholder/);
    }
  });
});

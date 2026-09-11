import { tripPlaceOptions } from '../fixtures/places.fixture';

/** Guards `places.fixture.ts` — the `/customize-tours` place picker source. */
describe('tripPlaceOptions fixture', () => {
  it('holds exactly 12 records', () => {
    expect(tripPlaceOptions).toHaveLength(12);
  });

  it('has unique slugs across all records', () => {
    const slugs = tripPlaceOptions.map((place) => place.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('gives every record a non-empty name and region', () => {
    for (const place of tripPlaceOptions) {
      expect(place.name.length).toBeGreaterThan(0);
      expect(place.region.length).toBeGreaterThan(0);
      expect(place.slug.length).toBeGreaterThan(0);
      expect(place.photoUrl.length).toBeGreaterThan(0);
    }
  });
});

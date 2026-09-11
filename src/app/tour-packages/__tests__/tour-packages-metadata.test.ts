import * as tourPackagesPage from '../page';
import * as rootLayout from '../../layout';

/**
 * F3 — `/tour-packages` reads `?category=` / `?destination=`, so it renders
 * per-request and every filter combination is a separately crawlable URL
 * carrying an IDENTICAL title and description. `?category=International`,
 * `?destination=goa` and the plain route were competing with each other as
 * near-duplicate content. The canonical consolidates them onto the base route.
 */
describe('/tour-packages canonical', () => {
  it('declares the plain route as canonical', () => {
    expect(tourPackagesPage.metadata.alternates?.canonical).toBe('/tour-packages');
  });

  it('exports metadata STATICALLY, so no filtered variant can self-canonicalise', () => {
    // A static object cannot read the query string at all, which is what makes
    // "every variant points at /tour-packages" structurally true rather than
    // merely currently true. If a future sprint wants per-filter titles it must
    // switch to `generateMetadata` AND set the canonical explicitly there —
    // this assertion is the tripwire that forces that decision to be deliberate.
    expect(typeof tourPackagesPage.metadata).toBe('object');
    expect(tourPackagesPage.metadata).not.toBeNull();
    expect('generateMetadata' in tourPackagesPage).toBe(false);
  });

  it('keeps the title and description it is consolidating', () => {
    expect(tourPackagesPage.metadata.title).toBe('Tour Packages');
    expect(tourPackagesPage.metadata.description).toEqual(expect.stringContaining('handpicked journeys'));
  });

  it('resolves against a real origin, so the emitted canonical is absolute', () => {
    // Without `metadataBase` Next resolves relative canonicals against
    // `http://localhost:3000` and warns at build time — a canonical pointing at
    // localhost is worse than none at all.
    expect(rootLayout.metadata.metadataBase).toBeInstanceOf(URL);
  });

  it('does not hardcode a guessed production domain', () => {
    // No live origin for this site is confirmed anywhere in the source material
    // (the design export gives a phone number and an email, not a URL), so the
    // origin comes from the environment. Inventing one would be exactly the
    // fabrication this branch has been removing everywhere else.
    const base = rootLayout.metadata.metadataBase as URL;
    const expected = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    expect(base.origin).toBe(new URL(expected).origin);
  });
});

/**
 * The composition root's ONE decision: which `ContentPort` the site runs on.
 *
 * `@prisma/client` is mocked so this suite never constructs a real client or
 * looks for an engine binary — the question here is which class gets built, not
 * whether Postgres answers.
 *
 * NOTE ON IMPORT STYLE: the adapter classes are imported INSIDE each test, after
 * `jest.resetModules()`, never at the top of the file. `resetModules()` gives the
 * next `import()` a fresh module registry, so a statically imported
 * `FixtureContentAdapter` would be a DIFFERENT class object from the one the
 * freshly-loaded composition root instantiated — and `toBeInstanceOf` would fail
 * with the baffling "Expected PrismaContentAdapter, Received
 * PrismaContentAdapter". Both sides must come from the same registry.
 */
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({})),
}));

describe('content-adapter (composition root)', () => {
  const originalUrl = process.env.DATABASE_URL;

  afterEach(() => {
    if (originalUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalUrl;
    }
    jest.resetModules();
  });

  /**
   * The mode the whole suite, `npm run build` and the Playwright run execute in.
   * "No database" is a SUPPORTED configuration, not a degraded one — which is
   * also why a green test run says nothing about the Prisma path
   * (BLOCKERS.md item 10).
   */
  it('falls back to the fixtures when DATABASE_URL is unset', async () => {
    delete process.env.DATABASE_URL;
    jest.resetModules();

    const { contentAdapter } = await import('../content-adapter');
    const { FixtureContentAdapter } = await import('../adapters/fixture-content-adapter');

    expect(contentAdapter).toBeInstanceOf(FixtureContentAdapter);
    // Moved here from `fixture-content-adapter.test.ts` when the singleton moved.
    await expect(contentAdapter.getPackageRails()).resolves.toHaveLength(4);
  });

  it('composes the Prisma adapter when DATABASE_URL is set', async () => {
    process.env.DATABASE_URL = 'postgresql://gty:pw@localhost:5432/gty_content?schema=public';
    jest.resetModules();

    const { contentAdapter } = await import('../content-adapter');
    const { PrismaContentAdapter } = await import('../adapters/prisma-content-adapter');

    expect(contentAdapter).toBeInstanceOf(PrismaContentAdapter);
  });

  it('serves content that never moved to the database from the fixtures either way', async () => {
    process.env.DATABASE_URL = 'postgresql://gty:pw@localhost:5432/gty_content?schema=public';
    jest.resetModules();

    const { contentAdapter } = await import('../content-adapter');

    // Stats/testimonials/videos/milestones/places were deliberately left on
    // fixtures (BLOCKERS.md §5), so these resolve without touching the mock
    // client at all — and keep their `isPlaceholder` honesty markers.
    const stats = await contentAdapter.getStats();
    expect(stats).toHaveLength(5);
    expect(stats.every((stat) => stat.isPlaceholder)).toBe(true);
  });
});

import type { Config } from 'jest';
import nextJest from 'next/jest';

/**
 * `next/jest` wires up the SWC transform, next/font mocking and CSS-module
 * handling for free — see tech spec §9 ("Framework/config to be finalized by
 * the FRONTEND-TESTS agent"). No babel config needed alongside it.
 */
const createJestConfig = nextJest({
  dir: './',
});

/**
 * `next-auth` and its `@auth/core` dependency ship ESM ONLY — there is no
 * CommonJS build. Jest skips transforming `node_modules` by default, so any test
 * that reaches the auth route handler dies on `SyntaxError: Cannot use import
 * statement outside a module` before running a single assertion.
 *
 * The list is `@auth/core`'s actual ESM-only dependency chain rather than a
 * guess: `jose` (JWT signing/encryption), `oauth4webapi`, and the `preact` pair
 * it uses to render its built-in pages. A narrow allow-list rather than
 * transforming all of `node_modules`, which would be slow and would hide the
 * next occurrence of this.
 */
const ESM_ONLY_PACKAGES_TO_TRANSFORM = [
  '/node_modules/(?!(next-auth|@auth/core|jose|oauth4webapi|preact|preact-render-to-string|geist|next/dist/client|next/dist/shared/lib)/)',
];

const customJestConfig: Config = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    /**
     * `server-only` is a marker package whose entire implementation is an
     * unconditional `throw` — it resolves to an empty module ONLY under React's
     * `react-server` export condition, which Next applies when bundling and Jest
     * does not. Without this mapping, every test that reaches an auth or database
     * module dies on the import rather than running.
     *
     * Mapping it to the package's own `empty.js` rather than to a hand-written
     * stub, so the shim is whatever the package itself considers the no-op.
     */
    '^server-only$': '<rootDir>/node_modules/server-only/empty.js',
  },
  /**
   * Scope discovery to `src` with `roots` (literal paths) rather than relying on
   * `testPathIgnorePatterns` (REGEXes). On Windows `<rootDir>` expands to
   * `C:\Users\...\GTY Website(1)`, where the backslashes read as invalid regex
   * escapes and `(1)` reads as a capture group — so a `<rootDir>/.claude/`
   * ignore pattern silently never matches. Without this, Jest walks
   * `.claude/worktrees/` and collects ~1700 suites from an unrelated project.
   * `roots` takes literal paths, so it has no such escaping hazard.
   */
  roots: ['<rootDir>/src'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/app/**/layout.tsx'],
  /**
   * Jest's 5s default is a poor fit here and was producing false failures that
   * moved between runs — `PackagesFilterBar`, `LeadModal.brochure` and
   * `GroupDeparturesList` each failed in a full parallel run and passed when
   * re-run alone, with no code change in between.
   *
   * The cause is cost, not deadlock. These are `userEvent` tests against large
   * client components (`TripBuilder` re-renders a ~40-tile picker grid on every
   * state change), and `userEvent` awaits a real macrotask between each
   * synthetic event. A multi-click test therefore pays that render cost several
   * times over, and when several workers contend for CPU it crosses 5s — so the
   * timeout was measuring machine load, not correctness.
   *
   * 30s is generous enough that a genuinely hung test still fails the run
   * rather than hanging the suite.
   */
  testTimeout: 30_000,
};

/**
 * `next/jest` appends its OWN `transformIgnorePatterns` after spreading the
 * config above, so setting the key there has no effect — the value is silently
 * replaced. The wrapper below awaits the generated config and re-applies ours.
 *
 * Verified rather than assumed: with the key set only in `customJestConfig`, the
 * CSRF suite still failed with `SyntaxError: Cannot use import statement outside
 * a module` from `next-auth/index.js`. This is the documented workaround for that
 * behaviour.
 *
 * `transformIgnorePatterns` is an OR: a file is skipped if ANY pattern matches.
 * So it is not enough to PREPEND ours — `next/jest`'s own blanket
 * `/node_modules/(?!...)` rule would still match `node_modules/next-auth` and
 * skip it. Its node_modules rules are therefore REPLACED, not merged, and the
 * packages they existed to allow (`geist`, `next/dist/client`,
 * `next/dist/shared/lib`) are carried into ours above so nothing that used to be
 * transformed stops being transformed.
 *
 * The `.pnpm`-shaped rules `next/jest` also emits are dropped deliberately: this
 * project installs with npm (there is a `package-lock.json` and no
 * `pnpm-lock.yaml`), so they can never match anything here.
 *
 * The CSS-module entry is kept — dropping it would push every `*.module.css`
 * import through the SWC transform. It is matched on `\.module\.` rather than on
 * the substring "module", because every node_modules pattern contains that
 * substring too; filtering on it keeps exactly the rules this override exists to
 * remove. (That mistake was made here first, and the CSRF suite kept failing
 * with the config looking correct.)
 */
export default async function jestConfig() {
  const generated = await createJestConfig(customJestConfig)();

  const cssModuleRules = (generated.transformIgnorePatterns ?? []).filter((pattern) =>
    pattern.includes('\\.module\\.')
  );

  return {
    ...generated,
    transformIgnorePatterns: [...ESM_ONLY_PACKAGES_TO_TRANSFORM, ...cssModuleRules],
  };
}

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

const customJestConfig: Config = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
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

export default createJestConfig(customJestConfig);

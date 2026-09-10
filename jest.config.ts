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
};

export default createJestConfig(customJestConfig);

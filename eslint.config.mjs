import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored Claude Design export + its bundled design-system runtime.
    // Read-only reference material, not project source — linting it produced
    // ~13.6k findings that drowned out real ones.
    "Documents/**",
    // Agent tooling, helper scripts, and checked-in worktrees. Not app source.
    ".claude/**",
  ]),
]);

export default eslintConfig;

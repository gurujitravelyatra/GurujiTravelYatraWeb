# Memory Index

| File | Type | Summary |
|---|---|---|
| `project_gty_pipeline_environment.md` | project | No git remote / no `gh` in this repo — CREATE-PR cannot run. Configured QG skills are claude-flow-specific; real gate is tsc + eslint + build. |
| `project_gty_sprint_state.md` | project | SPEC pipeline state on `feat/gty-site-setup`: gates green through `9177ffd`. Open: independent adversary gate, placeholder legal copy, unverified prices. |
| `project_gty_content_database.md` | project | CLAUDE.md line 56 overridden by the user: interim Postgres content DB (content only, no leads, no admin). Never run against a real database. Read before touching `prisma/`. |
| `feedback_qg_export-verbatim-false-copy.md` | feedback | Pixel-fidelity mandates get misapplied to copy, shipping claims that aren't true (2x). Fix that works is data-derived copy tests. Inject with any design export. |
| `feedback_qg_duplicate-fixture-transcription.md` | feedback | One entity shown twice in an export becomes two conflicting fixture records (2x); latest: two models were justified, but a safety flag was replicated across them only for duration, not price. Inject with any design-export transcription. |
| `feedback_qg_unenforced-safety-flag.md` | feedback | Agent flags unverified data (`pricingUnverified`) and ships it rendering normally (4x). All 4 now fixed; latest (`af92be2`) added the withhold-vs-mark rule and cross-fixture flag tests. Inject whenever data is flagged. |
| `feedback_qg_effect-derived-state.md` | feedback | eslint here hard-errors on `setState` inside `useEffect` (React Compiler rules). Derive state during render behind a guard. Inject with any React state work. |
| `feedback_qg_stale-invariant-after-fix.md` | feedback | A correct fix changes a collection's size or a route's contract; layout constants, sibling components, metadata and comments authored against the old invariant silently go stale (4x in one round). Inject with any fix that changes an invariant. |

## Not stored here (live in the repo instead)

- Open product decisions blocking GTY component/page work →
  `documentation/technical-specification/BLOCKERS.md` (committed).
- Architecture rules, sprint plan, ERP contract requirements →
  `Documents/guruji-travel-yatra-website-CLAUDE.md`.

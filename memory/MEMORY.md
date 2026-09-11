# Memory Index

| File | Type | Summary |
|---|---|---|
| `project_gty_pipeline_environment.md` | project | No git remote / no `gh` in this repo — CREATE-PR cannot run. Configured QG skills are claude-flow-specific; real gate is tsc + eslint + build. |
| `project_gty_sprint_state.md` | project | SPEC pipeline state on `feat/gty-site-setup`: gates green through `9177ffd`. Open: independent adversary gate, placeholder legal copy, unverified prices. |
| `feedback_qg_export-verbatim-false-copy.md` | feedback | Pixel-fidelity mandates get misapplied to copy, shipping claims that aren't true (2x). Fix that works is data-derived copy tests. Inject with any design export. |
| `feedback_qg_duplicate-fixture-transcription.md` | feedback | One entity shown twice in an export becomes two conflicting fixture records, then a merge helper silently picks a winner. Inject with any design-export transcription. |
| `feedback_qg_unenforced-safety-flag.md` | feedback | Agent flags unverified data (`pricingUnverified`) and ships it rendering normally (4x). Latest: gate is correct but scoped to one fixture; a new surface renders the same entity from a sibling fixture and bypasses it. Inject whenever data is flagged. |
| `feedback_qg_stale-invariant-after-fix.md` | feedback | A correct fix changes a collection's size or a route's contract; layout constants, sibling components, metadata and comments authored against the old invariant silently go stale (4x in one round). Inject with any fix that changes an invariant. |

## Not stored here (live in the repo instead)

- Open product decisions blocking GTY component/page work →
  `documentation/technical-specification/BLOCKERS.md` (committed).
- Architecture rules, sprint plan, ERP contract requirements →
  `Documents/guruji-travel-yatra-website-CLAUDE.md`.

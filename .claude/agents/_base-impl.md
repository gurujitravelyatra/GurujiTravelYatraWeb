# Implementation Agents Base

> Inherits: [_base-core.md](_base-core.md) + project `_base-project.md` | Used by: backend, frontend agents

## Required Input

- Written Technical Specification
- API contracts (DTOs)
- Acceptance criteria

Missing -> **STOP and ASK**

## Rules

- ONLY what specs describe
- No interpretation/extrapolation
- Ask if: behavior unclear, contracts missing, edge cases undefined

## Forbidden

- Endpoint/feature invention
- Business logic guessing
- God services/components

## A Fix That Changes an Invariant Leaves Stale Claims Behind It (escalated from QG feedback, 7 occurrences)

When a fix changes a collection's size, a route's contract, a field's derivation timing, or any other invariant, everything authored against the OLD invariant goes stale silently: layout constants, sibling components, code comments, schema doc comments, `BLOCKERS`/spec entries, and even user-facing legal copy have all shipped this way in this project — each looked like an unrelated file, so nobody thought to check it.

Before writing the fix:
1. **Grep for the OLD claim** (the old count, the old behavior's name, the old field's derivation) across the whole repo — code, comments, `Documents/*.md`, `documentation/**`, and any user-facing copy — not just the file you're editing.
2. **Update every hit**, or explicitly note in your handoff which ones you didn't and why.
3. Treat "this fix changes X" as a trigger to search for X everywhere, not just where X is implemented.

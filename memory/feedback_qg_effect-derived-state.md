---
name: QG pattern — state derived in an effect instead of during render
description: "eslint here runs React Compiler rules that hard-error on setState inside useEffect. Inject when an agent will write React state derived from props/context."
type: feedback
---

Pattern: An agent reaches for the familiar `useEffect(() => setX(...), [dep])`
to derive state from a changed prop/context value. This repo's eslint config
(`eslint-config-next` 16.3.4, React Compiler rules) treats that as an **error**,
not a warning, so it fails the gate:

```
react-hooks/set-state-in-effect
  Calling setState synchronously within an effect can trigger cascading renders
```

Occurrences: 1
Last seen: 2026-09-13
Affected agents: any agent writing React components (frontend, pipeline-executor)
Pipeline: perf fix on `feat/gty-site-setup`

Examples:
- `src/components/modals/ModalHost.tsx`: tracked "which modal variants have been
  opened at least once" with `useEffect` + `setOpenedVariants`. Fixed by adjusting
  state during render behind a guard — React's documented pattern:
  ```tsx
  if (activeVariant && !openedVariants.includes(activeVariant)) {
    setOpenedVariants([...openedVariants, activeVariant]);
  }
  ```
  The guard is what terminates the loop. This is also faster: React re-runs the
  component before paint, so no extra commit.

**Why:** the gate is `tsc --noEmit` + `eslint` + `next build` (see
`project_gty_pipeline_environment.md`), and eslint is 0-tolerance here. An
effect-derived-state habit costs a full recovery cycle every time.
**How to apply:** when dispatching an agent that will write React state, include:
"Derive state from a changed prop/context during render behind a guard, never
with setState inside useEffect — eslint errors on `react-hooks/set-state-in-effect`."

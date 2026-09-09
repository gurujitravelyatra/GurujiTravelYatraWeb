---
name: design-guidelines-loader
description: "Load design guidelines files based on the current task. Determines which guideline files to load (foundations, components, patterns) for the task at hand. Shared by UX agents and design compliance."
---

# Design Guidelines Loader

Smart loader for design guideline files. Avoids loading unnecessary files.

## When to Use
- Called by agent `ux-design` before analysis
- Called by agent `ux-to-spec` before spec writing
- Called by `design-compliance` skill before audit
- Called by agent `frontend` during Phase 4 (Rendering)

## Guidelines Path
`documentation/design-guidelines//`

## Loading Strategy

### Full Load (for audits / `design-compliance`)
Load ALL files:
1. `index.md` (always)
2. `foundations/*` (all)
3. `components/*` (all)
4. `patterns/*` (all)

### Targeted Load (for implementation / agents)

1. **Always load**: `index.md` (overview, catalog, decision trees)

2. **Load on demand** based on task:

| Task | Load |
|------|------|
| Choosing components | `index.md` only |
| Implementing buttons/actions | `components/actions.md` |
| Implementing forms | `components/forms.md` |
| Implementing navigation | `components/navigation.md` |
| Implementing data display | `components/data-display.md` |
| Implementing feedback | `components/feedback.md` |
| Implementing layout | `components/layout.md` |
| Implementing pickers | `components/pickers.md` |
| Color/spacing specifics | `foundations/colors.md`, `foundations/spacing.md` |
| Accessibility check | `foundations/accessibility-checklist.md` |
| Icons/imagery | `foundations/icons-imagery.md` |
| Settings views | `patterns/settings-view-pattern.md` |

### Detection Logic
Scan the task description and changed files to determine which guideline files are relevant:
- If task mentions "form", "input", "validation" → load `components/forms.md`
- If task mentions "button", "action", "click" → load `components/actions.md`
- If task mentions "color", "theme", "dark mode" → load `foundations/colors.md`
- If task mentions "spacing", "padding", "margin" → load `foundations/spacing.md`
- If task mentions "a11y", "accessibility", "WCAG" → load `foundations/accessibility-checklist.md`
- If changed files include navigation components → load `components/navigation.md`

## Output
Report which files were loaded and why:
```
Design Guidelines Loaded:
- index.md (always)
- components/forms.md (task mentions form validation)
- foundations/spacing.md (changed files include layout components)
```

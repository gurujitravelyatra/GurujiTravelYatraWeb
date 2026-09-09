---
name: figma-audit
description: Audit Figma components against the codebase and design guidelines. Classifies components as NEW/EXISTS/DRIFTED/GUIDELINE-ONLY, produces drift diff tables, variant parity matrices, and three-way comparison reports. Use before any Figma sync or build operation.
triggers:
  - figma audit
  - audit components
  - check figma drift
  - component classification
---

# Skill: figma-audit

Teaches Claude how to classify Figma components against the codebase and design guidelines.
Used by: FIGMA-SYNC agent, FIGMA-DESIGNER agent

---

## Step 1: Classify Each Component

For each component extracted from Figma, assign one of four statuses:

| Status | Meaning |
|--------|---------|
| `NEW` | Not found in any codebase location |
| `EXISTS` | Found — all resolved CSS values match Figma within tolerance (+-1px spacing, exact color) |
| `DRIFTED` | Found — one or more resolved values differ from Figma |
| `GUIDELINE-ONLY` | Exists per design guidelines but not yet in Figma — flag for designer awareness |

---

## Step 2: Produce a Drift Diff Table (for every DRIFTED component)

| Property | Figma value | Code token | Resolved value | Verdict |
|----------|-------------|------------|----------------|---------|
| background | `#5b5fc7` | `var(--brand-background)` | `#5b5fc7` | Match |
| height (md) | `32px` | `h-9` | `36px` | Drift |
| padding (md) | `6px 12px` | `px-4 py-1` | `4px 16px` | Drift |
| border-radius | `4px` | `rounded-lg` | `8px` | Drift |
| font-size | `14px` | `var(--font-size-300)` | `14px` | Match |

---

## Step 3: Variant & Behavioral Parity Check (for EXISTS and DRIFTED components)

### 3a — Extract Figma variant inventory
From the Figma component set, list every variant and property:
```
Example — Button component set:
  Appearances:  Primary | Secondary | Subtle | Ghost | Danger
  Sizes:        Small | Medium (default) | Large
  States:       Default | Hover | Pressed | Focused | Disabled | Loading
  Icon slots:   None | Icon before | Icon after | Icon only
```

### 3b — Extract code component prop API
Use graph to get source snippet (avoids full file read):
```
mcp__code-review-graph__get_review_context
  node_id: "<node_id>"
```
Collect: TypeScript prop types, conditional class branches, state handling, slot support.

### 3c — Build parity matrix

| Figma variant / state | Code prop / class | Status |
|-----------------------|-------------------|--------|
| Appearance: Primary | `appearance="primary"` | Covered |
| Appearance: Danger | `appearance="danger"` | Missing |
| State: Loading | `loading` prop | Missing |
| State: Focus | `:focus-visible` CSS | Partial — no visible ring |

### 3d — DOM / accessibility check
- Is the root element semantically correct? (`<button>` not `<div>` for buttons)
- Does it have `role`, `aria-label`, `aria-disabled` where Figma defines them?
- Does keyboard interaction work (Enter/Space for buttons, Escape for dismissibles)?

### 3e — Parity result classification

| Result | Meaning |
|--------|---------|
| `FULL PARITY` | All Figma variants, states, and props are implemented |
| `PARTIAL PARITY` | Core variants exist but some states/variants are missing |
| `SURFACE ONLY` | File exists, basic CSS matches, but variant coverage is critically incomplete |
| `BEHAVIOR MISMATCH` | Props exist but interactive behavior differs from Figma intent |

**Output per component:**
```
Component: Button
Parity:    PARTIAL PARITY
File:      /actions/Button.tsx
Missing:   Appearance=Danger, State=Loading, Icon-only variant
Partial:   Focus state (no visible ring)
Full:      Primary, Secondary, Subtle, Small, Medium, Large, Disabled, Hover
```

---

## Step 4: Design Guidelines Cross-Reference

Before any token mapping or code changes, load the relevant guideline file(s):

| File | Covers |
|------|--------|
| `documentation/design-guidelines//index.md` | Overview, view patterns, quick reference |
| `documentation/design-guidelines//foundations/colors.md` | Color tokens, themes |
| `documentation/design-guidelines//foundations/spacing.md` | Spacing scale, padding, margins |
| `documentation/design-guidelines//foundations/layout.md` | Grid, breakpoints, layout rules |
| `documentation/design-guidelines//foundations/icons-imagery.md` | Icon usage, sizes |
| `documentation/design-guidelines//foundations/accessibility-checklist.md` | WCAG requirements |
| `documentation/design-guidelines//components/actions.md` | Button, IconButton, SplitButton, MenuButton, Toolbar, Link |
| `documentation/design-guidelines//components/data-display.md` | Avatar, Badge, Card, List, Persona, Tag, Status |
| `documentation/design-guidelines//components/feedback.md` | Alert, Dialog, Toast, Tooltip, ProgressIndicator, Coachmark |
| `documentation/design-guidelines//components/forms.md` | Input, Checkbox, Dropdown, Slider, Toggle, Field, RadioGroup |
| `documentation/design-guidelines//components/layout.md` | Accordion, Divider, Drawer |
| `documentation/design-guidelines//components/navigation.md` | Breadcrumbs, Menu, Tablist, Tree, SecondaryNav |
| `documentation/design-guidelines//components/pickers.md` | DatePicker, PeoplePicker, FilePicker, TimePicker |
| `documentation/design-guidelines//patterns/design-guidelines-main-view-patterns.md` | Page-level patterns |

### Three-way comparison

| Source | What it provides |
|--------|-----------------|
| Figma | Visual design intent (source of truth for values) |
| Design guidelines | Documented specification (the rules layer) |
| Codebase | Current implementation |

### Divergence flags

- **Figma vs guidelines conflict** → STOP and flag for designer-developer alignment (blocker)
- **Codebase vs Figma/guidelines conflict** → mark as `DRIFTED`
- **Guideline mentions variant not in Figma** → log as `GUIDELINE-ONLY`

**Output:** Three-way comparison table per component. Figma<->guideline conflicts listed as blockers.

---

## Full Audit Output Format

```
=== FIGMA COMPONENT AUDIT ===
Scanned: <ISO date>
─────────────────────────────────────────────────────
SUMMARY
  Figma components : <total>
  EXISTS           : <n>  — in sync
  NEW              : <n>  — needs BUILD
  DRIFTED          : <n>  — needs SYNC
  GUIDELINE-ONLY   : <n>  — not yet in Figma

─────────────────────────────────────────────────────
NEW COMPONENTS (<n>):
  actions/  : <list>
  forms/    : <list>

DRIFTED COMPONENTS (<n>):
  <ComponentName> — drift table above

EXISTS COMPONENTS (<n>):
  <list>

BLOCKERS:
  <Figma <-> guideline conflicts, or "none">
─────────────────────────────────────────────────────
```

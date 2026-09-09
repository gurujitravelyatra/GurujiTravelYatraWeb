---
name: figma-design-intake
description: Parse a designer's natural-language brief into structured design requirements. Maps described UI elements to codebase components, identifies layout type, zones, states, and theme. Produces a parsed brief and component mapping for review before any Figma build starts. Used by FIGMA-DESIGNER agent for all DESIGN commands.
triggers:
  - design brief
  - design intake
  - parse design
  - figma design
  - DESIGN command
---

# Skill: figma-design-intake

Teaches Claude how to parse a designer's brief into structured, actionable requirements.
Used by: FIGMA-DESIGNER agent for all DESIGN commands.

---

## Step 1: Parse the Brief

From the designer's description, extract:

```
DESIGN BRIEF PARSED
───────────────────────────────────────────────────────────
Section name    : <name or auto-generated from description>
Layout type     : <page / card / form / list / dashboard / modal / other>
Purpose         : <what this UI does>
Key areas       : <list of UI zones: header, sidebar, content, footer, etc.>
Components      : <list of UI elements mentioned or implied>
States          : <default / empty / loading / error / success — if any>
Theme           : <default (light) / dark / high-contrast — assume default if not stated>
Breakpoint      : <desktop (1280px) / tablet (768px) / mobile (375px) — assume desktop if not stated>
───────────────────────────────────────────────────────────
```

If the brief is too vague (e.g. "make something nice") → **STOP and ASK** for: purpose, layout type, key areas.

---

## Step 2: Map UI Elements to Codebase Components

For each UI element mentioned or implied, search the graph:

```
mcp__code-review-graph__semantic_search_nodes
  query: "<element name>"
  node_types: ["function", "class"]
```

Record `node_id` and `file_path` for each match. Mark as `Custom Frame` if no match.

```
COMPONENT MAPPING
───────────────────────────────────────────────────────────
"header with title"      → Custom Frame  (no direct match)
"search box"             → forms/Searchbox    [node_id: <id>]
"action buttons"         → actions/Button    [node_id: <id>]
"status badge"           → data-display/StatusLabel    [node_id: <id>]
"data table"             → Custom Frame  (no match — build from scratch)
───────────────────────────────────────────────────────────
```

If a codebase component is mapped, it will be rendered as a **labelled placeholder frame** in Figma — not fully recreated. Full component detail is handled by the `BUILD` command.

---

## Step 3: Token Plan

Identify which design tokens apply to this design:

```
TOKEN PLAN
───────────────────────────────────────────────────────────
Surface fill        : --background-2 (#faf9f8)
Card fill           : --background-1 (#ffffff)
Primary text        : --foreground-1 (#242424)
Secondary text      : --foreground-2 (#616161)
Border              : --neutral-stroke-1 (#d1d1d1)
Brand accent        : --brand-background (#5b5fc7)
Radius              : --radius-medium (4px)
Spacing unit        : 4px base grid
───────────────────────────────────────────────────────────
```

Full token resolution is handled by the `figma-token-mapping` skill in the build phase.

---

## Step 4: Confirmation Gate

Print the parsed brief and ask:

```
Design brief understood. Ready to build.

Section    : <name>
Layout     : <type>, <breakpoint>
Zones      : <list>
Mapped     : <n> codebase components as placeholders
Custom     : <m> frames built from scratch
Tokens     : <list of key tokens>

Any corrections before I proceed? (yes, proceed / <corrections>)
```

**STOP and wait for confirmation before proceeding to build.**

---

## Common Layout Archetypes

Use these as starting points when the brief matches a known pattern:

### Page shell
```
Section (full-width)
  └ Header bar  — h:48px, fill:--background-1, border-bottom:--neutral-stroke-2
  └ Content area — flex-grow, fill:--background-2, padding:--spacing-24
      └ <content zones>
```

### Card layout
```
Frame — fill:--background-1, radius:--radius-large, shadow:--shadow-4
  padding: --spacing-16
  gap: --spacing-12
```

### Form section
```
Frame — VERTICAL, gap:--spacing-16
  Label  — Label style, --foreground-1
  Input  — h:32px, --background-3, border:--neutral-stroke-1, radius:--radius-medium
  Helper — Caption, --foreground-2
```

### Dashboard
```
Section (full-width)
  └ Header bar
  └ Stats row — HORIZONTAL, gap:--spacing-16 (Card x n)
  └ Content row — HORIZONTAL, gap:--spacing-16
      └ Main panel (wider) + Sidebar (narrower)
```

### Modal / Dialog
```
Frame — fill:--background-1, radius:--radius-xlarge, shadow:--shadow-28
  Header — h:48px, HORIZONTAL, gap:--spacing-8
  Body   — VERTICAL, padding:--spacing-24
  Footer — h:52px, HORIZONTAL, justify:flex-end, gap:--spacing-8
```

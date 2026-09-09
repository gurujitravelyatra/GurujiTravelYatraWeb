# Design Agents Base

> Inherits: [_base-core.md](_base-core.md), [_base-project.md](_base-project.md) | Used by: UX-DESIGN, UX-TO-SPEC, DESIGN-ENFORCER

## Required: Design Guidelines

Design guidelines are organized in tiers for optimal context usage.

### Always Load (All Design Agents)

```
documentation/design-guidelines//index.md
```

This file contains:
- View patterns overview (Simple Main, Sidebar Main, Settings View)
- Toolbar pattern and zones
- Component catalog (purpose + when to use)
- Content patterns (list, table, tree, cards, accordion)
- Decision trees for component selection

### Load On Demand

Load detailed files only when implementation specifics are needed:

**Foundations** (`documentation/design-guidelines//foundations/`):
- `colors.md` — Color tokens, semantic colors, themes
- `spacing.md` — Spacing scale, layout spacing
- `layout.md` — Breakpoints, grid, responsive behavior
- `icons-imagery.md` — Icon usage, image guidelines
- `accessibility-checklist.md` — WCAG checklist, a11y requirements

**Components** (`documentation/design-guidelines//components/`):
- `actions.md` — Button, Icon Button, Split Button, Menu Button, Toolbar, Link
- `data-display.md` — Avatar, Badge, DataGrid, Label, Persona, Text, Tag
- `feedback.md` — Dialog, Toast, Alert, Progress, Skeleton, Spinner
- `forms.md` — Input, Textarea, Select, Combobox, Checkbox, Radio, Switch, etc.
- `layout.md` — Card, Divider, Accordion, Panel
- `media.md` — Image, Icon
- `navigation.md` — Breadcrumb, Menu, Tree, Tablist, Left Nav
- `pickers.md` — Color Picker, People Picker, Emoji Picker
- `sort-filter.md` — Filter Pills, Filter Dropdown, Sort Menu, Search

**Patterns** (`documentation/design-guidelines//patterns/`):
- `settings-view-pattern.md` — Settings View structure, header, action bar

### Agent-Specific Loading

| Agent | Always Load | Load On Demand |
|-------|-------------|----------------|
| **UX-DESIGN** | `index.md` | Rarely needed (high-level decisions) |
| **UX-TO-SPEC** | `index.md` | When specifying component details |
| **DESIGN-ENFORCER** | `index.md` | All files for comprehensive audit |

Missing `index.md` → **STOP and ASK**

## Forbidden

- UX redesign without justification
- Color/brand invention
- Silent guideline deviation
- Feature development

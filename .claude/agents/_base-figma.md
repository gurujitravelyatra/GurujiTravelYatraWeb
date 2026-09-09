# Base Rules: Figma Agents

> Inherits: [_base-core.md](_base-core.md), [_base-project.md](_base-project.md)

Shared rules for all agents that interact with Figma or the design system.
Used by: FIGMA-SYNC, FIGMA-DESIGNER

---

## Graph-First Strategy

This project has a live knowledge graph (`code-review-graph` MCP — 15k+ nodes, 2,600+ files indexed).
**Always query the graph before Glob/Grep/Read** — it returns component metadata and source snippets in a single call.

| Graph tool | Use for |
|------------|---------|
| `mcp__code-review-graph__get_architecture_overview` | Full component inventory by category — replaces Glob + Read of all files |
| `mcp__code-review-graph__semantic_search_nodes` | Find a specific component by name → returns file path + node ID |
| `mcp__code-review-graph__get_review_context` | Get props/variants snippet for a node → avoids full file Read |
| `mcp__code-review-graph__query_graph` | Trace imports / callers for a component |
| `mcp__code-review-graph__get_impact_radius` | Understand blast radius of a change |

Fall back to Glob/Read **only** if the graph returns no match or insufficient detail.

---

## Codebase Search Locations (Fallback Order)

| Priority | Path | Purpose |
|----------|------|---------|
| 1 | `/**` | Primary design system — atoms & molecules |
| 2 | `packages/front/src/components/**` | Shared higher-level components |
| 3 | `packages/common/**` | Cross-app shared utilities and components |
| 4 | `apps/{{app}}/front/src/components/**` | App-specific components (last resort) |

Stop at the first location where a match is found.

---

## Design Token Sources

| File | Contains |
|------|----------|
| `` | Spacing, typography, z-index, breakpoints, radius |
| `` | Color tokens |

**Resolution chain for CSS values:**
1. Collect all `className`, inline styles, and `var(--token-name)` references
2. Resolve each `var(--token-name)` against `` and ``
3. Map Tailwind classes to CSS equivalents (e.g. `p-3` → `padding: 12px`)
4. Never hardcode raw hex/px values when a matching token exists

---

## Figma MCP Tool Priority

| Priority | Tool prefix | Connection |
|----------|-------------|-----------|
| 1 (preferred) | `mcp__figma-remote-mcp__use_figma` | Plugin API — requires Figma Desktop open |
| 2 (fallback) | `mcp__figma-remote-mcp__generate_figma_design` | AI-assisted — rate-limit exempt |
| 3 (read-only) | `mcp__figma__get_figma_data` | REST API — inventory queries only |

---

## Shared Forbidden Rules

- Using screenshots or visual snapshots to extract values — use Figma API only
- Skipping `semantic_search_nodes` and jumping straight to Glob/Grep
- Searching only `packages/front/src/components` — all 4 locations must be checked
- Hardcoding hex values when a matching token exists in ``
- Pushing directly to main or any protected branch
- Auto-deleting or overwriting existing Figma components without confirmation
- Writing to codebase files from an agent scoped to Figma-only (FIGMA-DESIGNER)

---

## Shared Stop Conditions

STOP and ASK if:
- Figma MCP / bridge is unavailable
- A component name is ambiguous (Figma name ≠ code name, no clear match)
- A design token is referenced in source but not found in ``
- A Figma ↔ design guidelines conflict is detected (requires human resolution)
- A Figma API error is returned and both write tools fail
- Brief or input is too vague to produce a deterministic output

---

## Component Source Map

| Category | Source path |
|----------|-------------|
| actions | `/actions/` |
| data-display | `/data-display/` |
| feedback | `/feedback/` |
| forms | `/forms/` |
| layout | `/layout/` |
| navigation | `/navigation/` |
| icons | `/icons/` |
| media | `/media/` |
| pickers | `/pickers/` |
| sort-filter | `/sort-filter/` |
| patterns | `/patterns/` |
| Design tokens | `` |

---

## Naming Convention

Figma component names must map to React component filenames:
- Figma: `PrimaryButton` → Code: `/actions/Button.tsx` (check existing name conventions first)
- Figma: `ChangeCard` → Code: `ChangeCard.rendering.tsx`
- When a match is found under a different name (e.g. Figma `Switch` → code `Toggle.tsx`) → log as `EXISTS (name differs)` and flag for naming alignment

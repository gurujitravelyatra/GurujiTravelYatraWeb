# Skill: design-workflow

Trigger phrase: `/design-workflow <subcommand>`

This skill is the **single entry point for all Figma work** in this project.
- Code → Figma operations: delegates to **FIGMA-SYNC** agent
- Figma → Design canvas operations: delegates to **FIGMA-DESIGNER** agent

Do NOT activate figma-sync or figma-designer directly — use this skill.

---

## Subcommands

### `/design-workflow scan`

**What it does:**
Activates FIGMA-SYNC in `AUDIT` mode — read-only comparison of codebase components vs Figma. No code changes, no Figma writes.

**Requires:**
```
/design-workflow scan
File: <figma-file-url or file-id>
Component: <component-name | "all">
```

**Output:** Full audit report (NEW / EXISTS / DRIFTED / GUIDELINE-ONLY classification) using the `figma-audit` skill.

---

### `/design-workflow build`

**What it does:**
Activates FIGMA-SYNC in `BUILD` mode — creates React components for Figma components not yet in the codebase.

**Requires:**
```
/design-workflow build
File: <figma-file-url or file-id>
Component: <component-name | "all">
```

**Flow:** Figma Extraction → Codebase Check → `figma-audit` → `figma-token-mapping` → Build → PR creation.

---

### `/design-workflow sync`

**What it does:**
Activates FIGMA-SYNC in `SYNC` mode — diffs components that exist in both Figma and codebase, updates drifted values.

**Requires:**
```
/design-workflow sync
File: <figma-file-url or file-id>
Component: <component-name | "all">
```

**Flow:** Same as `build` but targets only DRIFTED components. Stops for confirmation before each update.

---

### `/design-workflow setup`

**What it does:**
1. Verify the Figma Desktop Bridge Plugin is connected (`mcp__figma_console__figma_get_status`)
2. Extract all Figma variables → `bridge-ds/knowledge-base/registries/variables.json`
3. Extract published components → `bridge-ds/knowledge-base/registries/components.json`
4. Extract text styles → `bridge-ds/knowledge-base/registries/text-styles.json`
5. Extract icon library → `bridge-ds/knowledge-base/registries/icons.json`
6. Cross-reference codebase design tokens
7. Generate design guides in `bridge-ds/knowledge-base/guides/`
8. Build initial recipe index from existing Figma designs → `bridge-ds/knowledge-base/recipes/_index.json`

**When to use:** First time only, or after a major design system update.

---

### `/design-workflow status`

**What it does:**
1. Call `mcp__figma_console__figma_get_status`
2. Report: connected/disconnected, active Figma file, knowledge base population state
3. Suggest next action

**Expected output:**
```
Bridge DS Status
────────────────
Transport:     figma-console-mcp (WebSocket → Figma Desktop)
Connected:     yes
Active file:   YourDesignSystem.fig
Knowledge base: populated (variables: 142, components: 67, icons: 312)
Ready for:     /design-workflow make <description>
```

---

### `/design-workflow make <description>`

**What it does (full flow):**
1. Apply `figma-design-intake` skill → parse brief, map components, confirm with user
2. Consult knowledge base guides for design patterns
3. Score existing recipes for similarity → reuse or extend
4. Write CSpec YAML → save to `bridge-ds/specs/active/<name>.yaml`
5. Apply `figma-token-mapping` skill → resolve all token values
6. Convert CSpec → scene graph JSON
7. Compile via `bridge-ds/lib/compiler/compile.js` (26 rules enforced automatically)
8. Execute generated code in Figma via MCP transport
9. Take a screenshot to verify (`mcp__figma_console__figma_take_screenshot`)
10. Report result and iterate on feedback

**Example:**
```
/design-workflow make a user settings screen with profile section and notification preferences
```

**CSpec goes to:** `bridge-ds/specs/active/UserSettings-v1.yaml`

---

### `/design-workflow fix`

**What it does:**
1. Read current Figma state via MCP screenshot + component inspection
2. Compare against last compiled scene graph
3. Identify designer corrections (spacing, color, typography, layout)
4. Extract learnings → `bridge-ds/knowledge-base/learnings.json`
5. Patch affected recipes in `bridge-ds/knowledge-base/recipes/_index.json`
6. Recompile and re-execute corrected version
7. Re-verify with screenshot

**When to use:** After manually correcting the Figma output and wanting the system to learn from the correction.

---

### `/design-workflow done`

**What it does:**
1. Move active CSpec: `bridge-ds/specs/active/<name>.yaml` → `bridge-ds/specs/shipped/<name>.yaml`
2. Extract reusable patterns from the shipped design → new recipe entries
3. Update `bridge-ds/knowledge-base/recipes/_index.json`
4. Log final learnings
5. Print summary

---

### `/design-workflow drop`

**What it does:**
1. Move active CSpec: `bridge-ds/specs/active/<name>.yaml` → `bridge-ds/specs/dropped/<name>.yaml`
2. Extract any learnings from the abandoned direction
3. Append to `bridge-ds/knowledge-base/learnings.json` with reason for dropping
4. Clean up any draft Figma frames tagged with `bridge-ds` plugin data

---

## Subcommand → Agent Routing

| Subcommand | Agent | Mode |
|------------|-------|------|
| `scan` | FIGMA-SYNC | AUDIT |
| `build` | FIGMA-SYNC | BUILD |
| `sync` | FIGMA-SYNC | SYNC |
| `setup` | FIGMA-DESIGNER | Setup |
| `status` | FIGMA-DESIGNER | Status check |
| `make` | FIGMA-DESIGNER | DESIGN |
| `fix` | FIGMA-DESIGNER | Iteration |
| `done` | FIGMA-DESIGNER | Lifecycle |
| `drop` | FIGMA-DESIGNER | Lifecycle |

---

## Skills Used

| Skill | Used in |
|-------|---------|
| `figma-design-intake` | `make` (brief parsing + component mapping) |
| `figma-token-mapping` | `build`, `sync`, `make` (token resolution) |
| `figma-audit` | `scan`, `build`, `sync` (classification + drift analysis) |

---

## How the Make Flow Executes

```
1. Parse /design-workflow make <description>
2. Apply figma-design-intake skill → structured brief + component mapping
3. Read bridge-ds/knowledge-base/ (guides, recipes, learnings, registries)
4. Read .claude/agents/figma-designer.md for full agent rules
5. Choose archetype → pick template from bridge-ds/templates/
6. Apply figma-token-mapping skill → resolve all token values
7. Write CSpec YAML → bridge-ds/specs/active/<name>.yaml
8. Convert CSpec → scene graph JSON (in memory)
9. Run: node bridge-ds/lib/compiler/compile.js --input <scene.json> --kb bridge-ds/knowledge-base
10. Execute output via MCP:
    a. Detect transport: bridge-ds/lib/transport/adapter.js → detectTransport()
    b. Call mcp__figma_console__figma_execute({ code: <compiled output> })
11. Verify: mcp__figma_console__figma_take_screenshot()
12. Report result
```

---

## Transport Reference

| Priority | Key in `.mcp.json` | Tool prefix | Connection |
|---|---|---|---|
| 1 (preferred) | `figma-console` | `mcp__figma_console__` | WebSocket → Figma Desktop |
| 2 (fallback) | `figma` or `figma-mcp` | `mcp__figma__` | REST API → Figma Cloud |

Detection is automatic via `bridge-ds/lib/transport/adapter.js`.

---

## Key File Paths

| Path | Purpose |
|---|---|
| `bridge-ds/lib/compiler/compile.js` | Scene graph → Figma Plugin API compiler |
| `bridge-ds/lib/transport/adapter.js` | Transport auto-detection |
| `bridge-ds/knowledge-base/registries/variables.json` | Design token registry |
| `bridge-ds/knowledge-base/registries/components.json` | Component registry |
| `bridge-ds/knowledge-base/recipes/_index.json` | Reusable scene graph templates |
| `bridge-ds/knowledge-base/learnings.json` | Accumulated corrections |
| `bridge-ds/specs/active/` | Work-in-progress CSpec files |
| `bridge-ds/specs/shipped/` | Archived completed designs |
| `bridge-ds/specs/dropped/` | Abandoned designs |

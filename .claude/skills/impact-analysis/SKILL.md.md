---
name: impact-analysis
description: "Analyze modified files to identify cross-component impact. Use after implementation in any pipeline, or standalone after code changes. Produces ADO impact report + PR impact summary."
---

# Impact Analysis

Cross-component dependency analysis for code changes. Runs inline — no isolation needed.

## When to Use
- After implementation in ISSUE/FEATURE/PUSH pipelines
- After any code change to shared packages
- Standalone: `/impact-analysis`

## Required Input
- ADO work item ID and project name (optional — skip ADO posting if absent)
- Scope: which app, frontend / backend / full-stack

## Workflow

### 1. Collect Changed Files
Run `Bash(git diff --name-only origin/main..HEAD)` to get the changed file list. This is the ONLY Bash command in this skill — all other exploration uses dedicated tools.

### 2. Classify Changes

| Category | Path pattern | Impact scope |
|----------|-------------|--------------|
| Shared package | `packages/common/*` | ALL apps — high impact |
| Shared backend | `packages/back/*` | ALL backend apps — high impact |
| Shared frontend | `packages/front/*` | ALL frontend apps — high impact |
| App-specific backend | `apps/{{app}}/back/*` | Single app backend |
| App-specific frontend | `apps/{{app}}/front/*` | Single app frontend |
| Infrastructure | `devops/*`, `.github/*` | CI/CD, deployment |
| Documentation | `documentation//*` | No code impact |

### 3. Trace Dependencies

For shared packages (`packages/*`):
1. Search for imports using `Grep`
2. Map which apps consume the changed code
3. Assess depth: direct import = high risk, transitive = medium risk

For app code (`apps/<app>/*`):
1. Check shared interfaces (DTO, type, API contract in `packages/common`)
2. Check sibling dependencies
3. Check API contracts (backend endpoint → frontend consumers)

### 4. Risk Assessment

| Risk | Criteria |
|------|----------|
| HIGH | Shared package modified, type/interface changed, API contract changed |
| MEDIUM | Shared utility modified, re-exported module changed |
| LOW | App-specific change with no cross-boundary effect |
| NONE | Documentation, test-only changes, config-only changes |

### 5. Post Impact Report to ADO (if ADO ID provided)

Use `mcp__azure-devops__wit_add_work_item_comment` to post:

```
## Impact Analysis Report

### Changed Files
- `<file>` — <brief description of change>

### Cross-Component Impact
| Component | App(s) | Risk | Reason |
|-----------|--------|------|--------|
| <module> | <apps> | HIGH | Shared DTO modified |

### Shared Package Changes
- `packages/common/<file>` → imported by: `apps/<app>/...`

### Recommendations
- [ ] Verify <component> in <app> — <reason>

### Risk Summary
- HIGH: <count> | MEDIUM: <count> | LOW: <count>
```

### 6. Produce Impact Summary (always)

Output a concise summary (max 20 lines) for PR description:

```markdown
## Impact Analysis

**Risk level:** HIGH | MEDIUM | LOW

**Changed areas:**
- <area 1> (<app>)

**Potentially impacted components:**
- <component> in <app> — <risk> — <reason>

**Verification needed:**
- [ ] <action item>
```

## Rules
- Factual — based on actual imports and file dependencies, not speculation
- Concrete file paths
- Only flag components with real dependency chains
- If no cross-component impact: "No cross-component impact"

## Forbidden
- Implementing code fixes
- Modifying any files
- Guessing impacts without tracing dependencies

---
name: orchestrator-pipelines
description: "Pipeline definitions and selection logic for the ORCHESTRATOR. Reference doc, not a standalone agent."
---

# Orchestrator: Pipeline Definitions

> Loaded by: [orchestrator.md](orchestrator.md) — do not activate directly.

## Pipeline Selection

Scan task description for signals:

| Signal | Pipeline |
|--------|----------|
| feature card, work item, ADO, Azure DevOps, briefing, user story | FEATURE |
| bug, issue, defect, fix, ticket, incident | ISSUE |
| screen, mockup, screenshot, UX, redesign | UX |
| functional spec, feature spec, requirements doc | SPEC |
| technical spec + frontend only | FRONTEND-ONLY |
| technical spec + backend only | BACKEND-ONLY |
| documentation, doc-to-ado, views documentation, create ADO from docs | DOC-TO-ADO |
| push, push workflow, validate and push, review and push, commit and push | PUSH |
| review PR, PR review, code review PR, check PR | PR-REVIEW |
| ideation, brainstorm, new idea, explore feature, design feature | IDEATION |
| design brief, new screen, UI from description | FIGMA-DESIGN |
| figma drift, token mismatch, component build/update | FIGMA-SYNC |

Ambiguous -> STOP and ASK: "Which pipeline? [FEATURE / ISSUE / UX / SPEC / FRONTEND-ONLY / BACKEND-ONLY / DOC-TO-ADO / PUSH / IDEATION]"

## Notation

- `->` = sequential (must wait)
- `[A + B]` = parallel group (run together, all must complete before next step)
- `skill-name` = inline skill (runs in orchestrator context, no subagent spawn)
- Agent names without prefix = subagent spawn

## Pipelines

### FEATURE (full-stack)
ado-feature-briefing -> WAVE-CHECK -> func-to-tech-spec -> edge-case-adversary (SPEC-TIME) -> [backend + frontend] -> [backend-tests + frontend-tests] -> e2e -> edge-case-adversary (PRE-MERGE) -> QUALITY GATE -> CREATE-PR -> MEMORY-CHECK

| Step | Agent / Skill | Type | Model | Why |
|------|--------------|------|-------|-----|
| 1 | ado-feature-briefing (ADO Feature->Func Spec) | subagent | `haiku` | Fetches feature card from ADO via `ado-fetch` skill, produces func spec |
| 1b | WAVE-CHECK (uses `ado-fetch` skill) | inline | -- | Inspects ADO relations, builds dependency waves |
| 2 | func-to-tech-spec (Func->Tech Spec) | subagent | `sonnet` | Uses `spec-template` skill for structure |
| 2b | edge-case-adversary (SPEC-TIME) | subagent | `opus` | Independent adversarial pass on the tech spec + data model; flags spec-silent data states as product decisions **before** code exists. Blocker on an undefined Critical state |
| 3 | [backend + frontend] (Backend + Frontend) | **parallel** subagent | `sonnet` | Both read the same tech spec |
| 4 | [backend-tests + frontend-tests] (Backend Tests + Frontend Tests) | **parallel** subagent | `sonnet` | Each tests its own implementation |
| 5 | e2e (E2E) | subagent | `sonnet` | Needs both implementations complete |
| 5b | edge-case-adversary (PRE-MERGE) | subagent | `opus` | Adversarial edge-case probe of the diff + data model (0/1/N token resolution, null/empty/partial); independent of the implementer. Blocker on an undefined Critical state |
| 6 | QUALITY GATE (3 skills) | inline | -- | `github:code-review` -> `verification-quality` -> `v3-security-overhaul` |
| 7 | CREATE-PR | inline | -- | See [orchestrator-pr.md](orchestrator-pr.md) |
| 8 | MEMORY-CHECK | **auto** | -- | Save QG feedback, agent patterns, stale cleanup (silent, mandatory) |

If scope is frontend-only or backend-only, parallel groups collapse to single agents. The two `edge-case-adversary` passes still run.

### ISSUE (full-stack)
ado-issue-intake -> WAVE-CHECK -> [critical-thinker + monorepo-architect + edge-case-adversary (SPEC-TIME)] -> [backend + frontend] -> [backend-tests + frontend-tests] -> `impact-analysis` -> `spec-update` -> sonarcloud -> edge-case-adversary (PRE-MERGE) -> QUALITY GATE -> CREATE-PR -> MEMORY-CHECK

| Step | Agent / Skill | Type | Model | Why |
|------|--------------|------|-------|-----|
| 1 | ado-issue-intake (ADO Issue->Analysis) | subagent | `haiku` | Fetches issue via `ado-fetch` skill |
| 1b | WAVE-CHECK (uses `ado-fetch` skill) | inline | -- | Inspects ADO relations, builds dependency waves |
| 2 | [critical-thinker + monorepo-architect + edge-case-adversary (SPEC-TIME)] | **parallel** subagent | `opus` | Challenge the problem + find architectural solution + adversarial edge-case/data-state analysis of the bug (the #9469-class 0/1/N missing-value trap). Blocker on an undefined Critical state |
| 3 | [backend + frontend] (Backend + Frontend) | **parallel** subagent | `sonnet` | Both implement the fix |
| 4 | [backend-tests + frontend-tests] (Backend Tests + Frontend Tests) | **parallel** subagent | `sonnet` | Test fix + add coverage |
| 5 | `impact-analysis` skill | **inline** | -- | Analyze cross-component impact, post to ADO |
| 6 | `spec-update` skill | **inline** | -- | Update or create tech spec for the fix |
| 7 | sonarcloud | subagent | `sonnet` | Security & vulnerability scan on the fix |
| 7b | edge-case-adversary (PRE-MERGE) | subagent | `opus` | Adversarial edge-case probe of the fix diff + data model, independent of the implementer. Blocker on an undefined Critical state |
| 8 | QUALITY GATE (3 skills) | inline | -- | Code review + security + verification |
| 9 | CREATE-PR | inline | -- | PR includes impact summary from step 5 |
| 10 | MEMORY-CHECK | **auto** | -- | Save QG feedback, agent patterns, stale cleanup (silent, mandatory) |

### UX (frontend)
ux-design -> ux-to-spec -> edge-case-adversary (SPEC-TIME) -> frontend -> frontend-tests -> e2e -> `design-compliance` -> edge-case-adversary (PRE-MERGE) -> QUALITY GATE -> CREATE-PR -> MEMORY-CHECK

| Step | Agent / Skill | Type | Model | Why |
|------|--------------|------|-------|-----|
| 1 | ux-design | subagent | `sonnet` | Uses `design-guidelines-loader` skill |
| 2 | ux-to-spec | subagent | `sonnet` | Uses `design-guidelines-loader` + `spec-template` skills |
| 2b | edge-case-adversary (SPEC-TIME) | subagent | `opus` | Independent adversarial pass on the UX-derived spec + data model; flags spec-silent data states (empty list, 0/1/N items, optional/absent fields) as product decisions **before** code exists. Blocker on an undefined Critical state |
| 3 | frontend | subagent | `sonnet` | Implements from spec |
| 4 | frontend-tests | subagent | `sonnet` | Tests implementation |
| 5 | e2e | subagent | `sonnet` | E2E tests |
| 6 | `design-compliance` skill | **inline** | -- | Audit against design guidelines |
| 6b | edge-case-adversary (PRE-MERGE) | subagent | `opus` | Adversarial edge-case probe of the diff + data model (0/1/N rendering, null/empty/partial states), independent of the implementer. Blocker on an undefined Critical state |
| 7 | QUALITY GATE (3 skills) | inline | -- | Code review + security + verification |
| 8 | CREATE-PR | inline | -- | -- |
| 9 | MEMORY-CHECK | **auto** | -- | Silent, mandatory |

### SPEC (full-stack)
func-to-tech-spec -> edge-case-adversary (SPEC-TIME) -> [backend + frontend] -> [backend-tests + frontend-tests] -> e2e -> edge-case-adversary (PRE-MERGE) -> QUALITY GATE -> CREATE-PR -> MEMORY-CHECK

Same parallel groups as FEATURE, starting from tech spec. func-to-tech-spec uses `spec-template` skill. Implementation/tests are `sonnet`; both `edge-case-adversary` passes are `opus` (SPEC-TIME after the tech spec, PRE-MERGE before QG — same roles as FEATURE steps 2b/5b).

### FRONTEND-ONLY
frontend -> frontend-tests -> e2e -> QUALITY GATE -> CREATE-PR -> MEMORY-CHECK

All sequential — single track. Model: `sonnet`.

### BACKEND-ONLY
backend -> backend-tests -> e2e -> QUALITY GATE -> CREATE-PR -> MEMORY-CHECK

All sequential — single track. Model: `sonnet`.

### PUSH (validation + delivery)
LINT -> `spec-update` -> [backend-tests + frontend-tests] -> e2e -> `impact-analysis` -> QUALITY GATE -> COMMIT-PUSH -> CREATE-PR -> ADO-LINK -> MEMORY-CHECK

| Step | Agent / Skill / Action | Type | Why |
|------|----------------------|------|-----|
| 1 | LINT (project lint command) | direct cmd | Auto-fix formatting and lint issues |
| 2 | `spec-update` skill | **inline** | Update/create documentation based on the diff |
| 3 | [backend-tests + frontend-tests] | **parallel** subagent | `sonnet` -- update/create unit tests |
| 4 | e2e | subagent | `sonnet` -- update E2E tests if UI behavior changed |
| 5 | `impact-analysis` skill | **inline** | Detect cross-component impact for PR body |
| 6 | QUALITY GATE (3 skills) | inline | Code review + security + verification |
| 7 | COMMIT-PUSH | direct cmd | `git add -A && git commit && git push` |
| 8 | CREATE-PR | inline | See [orchestrator-pr.md](orchestrator-pr.md) |
| 9 | ADO-LINK (uses `ado-create-work-items` skill) | **inline** | Create ADO work item + link to parent |
| 10 | MEMORY-CHECK | **auto** | Silent, mandatory |

If scope is frontend-only -> skip backend-tests. If backend-only -> skip frontend-tests + e2e.

**COMMIT-PUSH step:**
1. Stage: `git add -A`
2. Message: `<type>(<app>): <brief summary>` (feat/fix/chore/ui/api)
3. Commit + Push

**ADO-LINK step:**
1. Extract parent work item ID from branch name
2. If no work item ID -> skip
3. Invoke `ado-create-work-items` skill with Task type
4. Link to parent + post comment

### PR-REVIEW (read-only)
[`github:code-review` + `sonarcloud:analyze-and-fix` + `verification-quality` + `v3-security-overhaul`] -> `pr-review-aggregate` -> MEMORY-CHECK

| Step | Skill | Type | Why |
|------|-------|------|-----|
| 1 | [`github:code-review` + `sonarcloud:analyze-and-fix` + `verification-quality` + `v3-security-overhaul`] | **parallel** inline | Four independent review skills |
| 2 | `pr-review-aggregate` skill | **inline** | Collects, deduplicates, classifies, posts PR comment |

**Required input:** PR number. **No worktree check** — read-only. **No CREATE-PR / No Quality Gate.**

### DOC-TO-ADO (no code)
[critical-thinker + monorepo-architect] -> doc-to-ado -> MEMORY-CHECK

| Step | Agent / Skill | Type | Model | Why |
|------|--------------|------|-------|-----|
| 1 | [critical-thinker + monorepo-architect] | **parallel** subagent | `opus` | Validate documentation |
| 2 | doc-to-ado | subagent | `sonnet` | Uses `ado-create-work-items` skill internally |

**Required inputs:** App name, ADO project, ADO area path. **No Quality Gate or CREATE-PR.**

### IDEATION (brainstorm -> decompose -> DAG dispatch)
`brainstorming`([critical-thinker + monorepo-architect]) -> DECOMPOSE -> `ado-create-work-items` (loop) -> DAG EXECUTOR

Each feature in the breakdown runs its own pipeline:

| Scope | Per-Feature Pipeline | Models |
|-------|---------------------|--------|
| `frontend-only` | [func-spec-writer + func-to-tech-spec] -> frontend -> frontend-tests -> e2e -> QG -> CREATE-PR | `sonnet` |
| `backend-only` | [func-spec-writer + func-to-tech-spec] -> backend -> backend-tests -> QG -> CREATE-PR | `sonnet` |
| `full-stack` | [func-spec-writer + func-to-tech-spec] -> [backend + frontend] -> [backend-tests + frontend-tests] -> e2e -> QG -> CREATE-PR | `sonnet` |

| Step | What | Type | Details |
|------|------|------|---------|
| 1 | `brainstorming` skill with [critical-thinker + monorepo-architect] | interactive | `opus` reasoning via critical-thinker + monorepo-architect |
| 2 | DECOMPOSE | inline | Orchestrator reads Feature Breakdown, builds DAG |
| 3 | `ado-create-work-items` skill (loop) | **inline** | Called once per feature — creates ADO hierarchy |
| 4 | DAG EXECUTOR | autonomous | See [orchestrator-dag.md](orchestrator-dag.md) |

<!-- Default ADO project comes from project config -->
**Required inputs:** Feature description, app name, ADO project.

### FIGMA-DESIGN
`figma-design-intake` -> figma-designer (DESIGN) -> [`figma-audit` + `design-compliance`] -> QG -> CREATE-PR -> MEMORY-CHECK

### FIGMA-SYNC
`figma-audit` -> figma-sync (BUILD/SYNC) -> [frontend-tests + `design-compliance`] -> QG -> CREATE-PR -> MEMORY-CHECK

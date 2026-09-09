# Multi-Agent Operating Manual

## Core Rules
- STRICT MANUAL multi-agent workflow
- NOT autonomous — MUST obey activated agent only
- NO implicit role switching
- Feature development requires Technical Specifications
- Missing specs → STOP and ASK
- **ORCHESTRATOR budget cap (AUTO):** opus ≤5K tokens — selects pipeline, confirms, spawns sonnet executor, then stops. Opus never reads files, compresses handoffs, verifies output, or runs MEMORY-CHECK

## Activation Protocol

**To activate:** `Activate <AGENT_NAME>`
**Agent MUST respond:** `Agent <AGENT_NAME> activated.`
No confirmation = No action.

## Available Agents ()

All in `.claude/agents/` with YAML frontmatter (name, description, model, tools).

| Name | Purpose | Model | Mode |
|------|---------|-------|------|
| ORCHESTRATOR | Pipeline coordinator (selects pipeline, confirms, spawns sonnet executor) | `opus (≤5K) → sonnet` | inline |
| PIPELINE-EXECUTOR | Runs full pipeline after opus selects it (compress handoffs, QG, PR, MEMORY-CHECK) | `sonnet` | subagent (spawned by ORCHESTRATOR) |
| CRITICAL-THINKER | Challenge reasoning, assumptions | `opus` | inline / subagent |
| EDGE-CASE-ADVERSARY | Adversarial edge-case gate (spec-time + pre-merge); data-model-seeded, read-only | `opus` | subagent |
| BACKEND | NestJS implementation (spec-driven) | `sonnet` | subagent + worktree |
| MONOREPO-ARCHITECT | Architecture enforcement | `opus` | inline / subagent |
| FRONTEND | React implementation (spec-driven) | `sonnet` | subagent + worktree |
| FRONTEND-REFACTOR | App-wide React refactoring | `sonnet` | subagent + worktree |
| FRONTEND-TESTS | Jest + RTL unit tests | `sonnet` | subagent + worktree |
| BACKEND-TESTS | NestJS + Jest unit tests | `sonnet` | subagent + worktree |
| BUGFIX | Test-driven bug fixing (failing test → fix → verify) | `opus` | subagent + worktree |
| STORYBOOK | Storybook setup & stories | `haiku` | subagent + worktree |
| UX-DESIGN | Screen analysis & redesign | `sonnet` | subagent |
| UX-TO-SPEC | UX → Technical Spec | `sonnet` | subagent |
| FUNC-TO-TECH-SPEC | Functional → Technical Spec | `sonnet` | subagent |
| INFRA | Azure + GitHub Actions | `sonnet` | subagent + worktree |
| E2E | End-to-end testing | `sonnet` | subagent + worktree |
| AI-VERIFY | Verify one ADO bug vs `develop` fix-build (Playwright proof → verdict comment/tag; tester decides) | `opus` | subagent |
| AI-VERIFY-TRIAGE | Read-only queue/classifier for AI-Verify (ledger, priority, lane, verifiable-vs-human) | `sonnet` | inline / subagent |
| SONARCLOUD | SonarCloud issue analysis & fix | `sonnet` | subagent + worktree |
| LOCALIZE |  manifest localization (35 languages) | `haiku` | subagent + worktree |
| ADO-FEATURE-BRIEFING | ADO feature card → Functional Spec | `haiku` | subagent |
| ADO-ISSUE-INTAKE | ADO bug/issue → Issue Analysis | `haiku` | subagent |
| ADO-CRAWLER | ADO batch dispatch → worktree + pipeline per item | `opus` | inline |
| DOC-TO-ADO | Documentation → ADO Features, Tasks, links | `sonnet` | subagent |
| FUNC-SPEC-WRITER | Brainstorm design → Functional Spec | `sonnet` | subagent |
| FIGMA-SYNC | Figma → codebase component sync | `sonnet` | subagent + worktree |
| FIGMA-DESIGNER | Code → Figma component sync | `sonnet` | subagent |

## Base Files

In `.claude/agents/`: `_base-core.md` (framework rules + handoff protocol), `_base-project.md` (stack, model routing table), `_base-impl.md`, `_base-test.md`, `_base-spec.md`, `_base-figma.md`, `_refs.md`.

## Orchestrator Modules

In `.claude/agents/`: `orchestrator.md` (core — pipeline selection + executor spawn), `pipeline-executor.md` (sonnet executor — runs full pipeline after opus confirms), `orchestrator-pipelines.md` (step definitions + model routing — loaded by executor), `orchestrator-dag.md` (DAG executor for IDEATION), `orchestrator-pr.md` (QG + PR creation). Load on demand per pipeline phase.

## Orchestrator Execution Model

### AUTO mode (opus ≤5K tokens)

```
opus: read task → select pipeline → confirm with user → spawn sonnet executor → STOP
sonnet executor: run all steps → compress handoffs → commit → QG → CREATE-PR → MEMORY-CHECK → return summary
```

If the executor hits context limits: it returns `EXECUTOR HANDOFF: completed=<...> remaining=<...>` and opus spawns a **new** sonnet executor for the remaining steps. Opus never takes over.

### STEP mode

```
opus: ask "Proceed? (yes/skip/stop)" between steps
sonnet subagent: runs each step's implementation
```

Opus reads the child's `[ORCHESTRATOR HANDOFF]` block verbatim and passes it to the next step. Opus never edits code, verifies output, or writes summaries.

### What opus MUST NOT do (either mode)

Read implementation files · edit/generate code · run tsc/biome/jest · compress handoffs · verify subagent output · write summaries · run MEMORY-CHECK · take over when a sonnet agent fails

## Skills ( active)

In `.claude/skills/`:

**Converted from agents:** `impact-analysis`, `spec-update`, `design-compliance`, `pr-review-aggregate`, `ado-create-work-items`
**Shared extractions:** `ado-fetch`, `spec-template`, `design-guidelines-loader`
**Pipeline:** `brainstorming`, `design-workflow`, `figma-audit`, `figma-design-intake`, `figma-token-mapping`
**Quality Gate:** `github-code-review`, `verification-quality`, `v3-security-overhaul`
**Utility:** `sonarcloud-analysis`, `skill-builder`

## Predefined Pipelines

`→` = sequential | `[A + B]` = parallel | `skill` = inline skill | **MC** = MEMORY-CHECK (sonnet executor, not opus)

In AUTO mode the entire sequence after confirmation is run by the sonnet pipeline executor. In STEP mode each step is a sonnet subagent; opus only advances between steps.

| Pipeline | Trigger | Sequence |
|----------|---------|----------|
| FEATURE | Feature card, work item, ADO | ado-feature-briefing → WAVE-CHECK → func-to-tech-spec → edge-case-adversary(spec-time) → [backend + frontend] → [backend-tests + frontend-tests] → e2e → edge-case-adversary(pre-merge) → QG → CREATE-PR → **MC** |
| ISSUE | Bug, issue, defect, fix | ado-issue-intake → WAVE-CHECK → [critical-thinker + monorepo-architect + edge-case-adversary(spec-time)] → [backend + frontend] → [backend-tests + frontend-tests] → `impact` → `spec-update` → sonarcloud → edge-case-adversary(pre-merge) → QG → CREATE-PR → **MC** |
| UX | Screen, mockup, UX issue | ux-design → ux-to-spec → edge-case-adversary(spec-time) → frontend → frontend-tests → e2e → `design-compliance` → edge-case-adversary(pre-merge) → QG → CREATE-PR → **MC** |
| SPEC | Functional spec provided | func-to-tech-spec → edge-case-adversary(spec-time) → [backend + frontend] → [backend-tests + frontend-tests] → e2e → edge-case-adversary(pre-merge) → QG → CREATE-PR → **MC** |
| FRONTEND-ONLY | Tech spec, FE scope | frontend → frontend-tests → e2e → QG → CREATE-PR → **MC** |
| BACKEND-ONLY | Tech spec, BE scope | backend → backend-tests → e2e → QG → CREATE-PR → **MC** |
| PUSH | Validate and push | LINT → `spec-update` → [backend-tests + frontend-tests] → e2e → `impact` → QG → COMMIT-PUSH → CREATE-PR → ADO-LINK → **MC** |
| PR-REVIEW | Review PR | [`code-review` + `sonarcloud` + `verification` + `security`] → `pr-review-aggregate` → **MC** |
| DOC-TO-ADO | Documentation → ADO | [critical-thinker + monorepo-architect] → doc-to-ado → **MC** |
| IDEATION | Brainstorm, new idea | `brainstorming`([critical-thinker + monorepo-architect]) → DECOMPOSE → `ado-create-work-items` → DAG EXECUTOR → **MC** |
| FIGMA-DESIGN | Design brief | `figma-design-intake` → figma-designer → [`figma-audit` + `design-compliance`] → QG → CREATE-PR → **MC** |
| FIGMA-SYNC | Figma drift | `figma-audit` → figma-sync → [frontend-tests + `design-compliance`] → QG → CREATE-PR → **MC** |
| AI-VERIFY | Verify bug(s) "In Testing" | ai-verify-triage → ai-verify (per WI) → *(tester approves/rejects — no PR, no state change)* |

**MC** = MEMORY-CHECK — silent, mandatory, runs inside the **sonnet pipeline executor** (never opus). Saves QG feedback patterns, agent learnings, resolves stale memories.

## Agent Loading

When activated, load:
1. `.claude/agents/_base-core.md` (framework rules, handoff protocol, stop conditions)
2. `.claude/agents/_base-project.md` (stack config, model routing table)
3. `.claude/agents/<agent>.md` (specific agent)

The sonnet pipeline executor additionally loads `orchestrator-pipelines.md` to resolve step sequences and model routing for child dispatches.

## Global Stop Conditions

STOP and ASK if: instructions conflict, scope ambiguous, role switch implied, action violates constraints.

# Project Rules

> Refs: [_refs.md](_refs.md)

## Stack

| Layer | Tech | Paths |
|-------|------|-------|
| Backend | nestjs, typescript, pnpm | `apps/{{app}}/back`, `packages/back`, `packages/common` |
| Frontend | react, typescript, zustand | `apps/{{app}}/front`, `packages/front`, `packages/common` |
| Auth | jwt | Shared services |

## Architecture

- SOLID (SRP, DIP mandatory)
- Shared → `packages/back`/`packages/front`/`packages/common` | App-specific → `apps/<app>/*`
- API contracts → `packages/common`
- No deep imports, no circular deps

## Code Quality

- No `any` | DTOs + class-validator (BE) | Typed hooks (FE)
- No logic in controllers/components

## Security

- No secrets in code/logs
- JWT via shared guards only

## Forbidden (Universal)

- Feature invention (unless role permits)
- Silent assumptions
- Spec deviation "for improvement"
- Unjustified rewrites

## Model Routing

When the ORCHESTRATOR dispatches agents as subagents (via the `Agent` tool), each agent runs in its own isolated context with a model selected for cost/capability balance.

| Tier | Model | Agents | Rationale |
|------|-------|--------|-----------|
| **Routing** | `opus (≤5K tok) → sonnet` | ORCHESTRATOR | Selects pipeline + confirms with user (≤5K tokens), then spawns a single sonnet pipeline executor that runs the entire pipeline. Opus never touches code, handoffs, or MEMORY-CHECK. Hard cap prevents implementation work on the most expensive model. |
| **Reasoning** | `opus` | CRITICAL-THINKER, MONOREPO-ARCHITECT, EDGE-CASE-ADVERSARY, BUGFIX | Complex analysis, architecture decisions, challenge reasoning, adversarial edge-case gating, test-driven bug fixing — only when dispatched by the executor as subagents |
| **Implementation** | `sonnet` | BACKEND, FRONTEND, FRONTEND-REFACTOR, FRONTEND-TESTS, BACKEND-TESTS, UX-DESIGN, UX-TO-SPEC, FUNC-TO-TECH-SPEC, E2E, SONARCLOUD, DOC-TO-ADO, FUNC-SPEC-WRITER, FIGMA-SYNC, FIGMA-DESIGNER, PIPELINE-EXECUTOR | Code generation, spec writing, pipeline execution, handoff compression, MEMORY-CHECK |
| **Extraction** | `haiku` | STORYBOOK, LOCALIZE, ADO-FEATURE-BRIEFING, ADO-ISSUE-INTAKE | Data extraction, repetitive tasks, API-call-heavy work |
| **Inline skills** | caller's model | `impact-analysis`, `spec-update`, `design-compliance`, `pr-review-aggregate`, `ado-create-work-items` | Converted from agents — reusable procedures, no isolation needed |
| **Shared skills** | caller's model | `ado-fetch`, `spec-template`, `design-guidelines-loader` | Extracted shared logic used by multiple agents |

> Agents CRITICAL-THINKER, MONOREPO-ARCHITECT run inline (skill-mode) when invoked directly. They run as `opus` subagents only when dispatched by the ORCHESTRATOR in parallel groups.

### Dispatch Modes

| Mode | Context | Token Budget | Use When |
|------|---------|-------------|----------|
| **Inline (skill)** | Shared with caller | Caller's window | Agent needs conversation history or is interactive |
| **Subagent** | Isolated | Own window | Agent produces artifacts independently, no interaction needed |
| **Subagent + worktree** | Isolated + git worktree | Own window | Agent writes code on a branch. **Worktrees MUST be created under `.claude/worktrees/<feature-name>`** — never in sibling directories or `/tmp`. |

## Handoff Compression

When the ORCHESTRATOR receives output from a subagent, it **compresses the handoff** before injecting into the pipeline context:

1. Extract: `Artifact path`, `Open Questions`, `Assumptions`, `Blocker status`
2. Extract: Key decisions and file list (max 20 lines)
3. Discard: Full implementation details, verbose explanations, raw data payloads

This prevents token bloat in the orchestrator's context window across multi-step pipelines.

## Protocol

**Input:** Missing/ambiguous → **STOP and ASK**

**Output:** Explicit actions, flagged assumptions, no vague statements

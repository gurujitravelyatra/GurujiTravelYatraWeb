# Base Rules (All Agents) — Core

> This file contains framework-level rules shared by ALL agents. Project-specific rules
> (stack, architecture, paths, model routing) belong in `_base-project.md` generated from
> the project pack.

## Tool Usage (Mandatory)

NEVER use Bash for operations that have a dedicated tool. Dedicated tools return structured, optimized output — 5-20x fewer tokens than raw Bash output.

| Task | Use This | NOT This |
|------|----------|----------|
| Find files by pattern | `Glob("**/*.tsx")` | `Bash(find . -name "*.tsx")` |
| Search file content | `Grep("pattern")` | `Bash(grep -r "pattern" .)` |
| Read file content | `Read(file_path)` | `Bash(cat file)` or `Bash(head file)` |
| Read specific lines | `Read(file, offset=N, limit=M)` | `Bash(sed -n 'N,Mp' file)` |
| List directory contents | `Glob("dir/*")` | `Bash(ls dir/)` |
| Edit file content | `Edit(file, old, new)` | `Bash(sed -i 's/old/new/' file)` |
| Write new file | `Write(file, content)` | `Bash(echo "..." > file)` |

**Bash is ONLY for:** git commands, package manager commands (pnpm/npm/yarn), build/test runners, system operations (mkdir, mv, rm), and running scripts.

## Forbidden (Universal)

- Feature invention (unless role permits)
- Silent assumptions
- Spec deviation "for improvement"
- Unjustified rewrites

## Dispatch Modes

| Mode | Context | Token Budget | Use When |
|------|---------|-------------|----------|
| **Inline (skill)** | Shared with caller | Caller's window | Agent needs conversation history or is interactive |
| **Subagent** | Isolated | Own window | Agent produces artifacts independently, no interaction needed |
| **Subagent + worktree** | Isolated + git worktree | Own window | Agent writes code on a branch. **Worktrees MUST be created under `.claude/worktrees/<feature-name>`** — never in sibling directories or `/tmp`. |

## Handoff Compression

Each agent MUST output an `[ORCHESTRATOR HANDOFF]` block at the end of its response. The orchestrator reads this block verbatim — it does NOT re-compress or verify.

In AUTO mode, the sonnet pipeline executor owns all handoff compression and context threading. In STEP mode, opus reads the child's pre-compressed block and injects it into the next child's context unchanged.

Required fields in every `[ORCHESTRATOR HANDOFF]` block:
1. `Artifact:` — file path or "inline"
2. `Files changed:` — max 10 items
3. `Key decisions:` — max 5 bullet points
4. `Open questions:` — list or "none"
5. `Blocker:` — YES | NO

Discard: full implementation details, verbose explanations, raw data payloads. This cap keeps handoff tokens off opus.

## Activation Protocol

**To activate:** `Activate <AGENT_NAME>`
**Agent MUST respond:** `Agent <AGENT_NAME> activated.`
No confirmation = No action.

## Stop Conditions

STOP and ASK if:
- Instructions conflict
- Scope ambiguous
- Role switch implied
- Action violates constraints

## Skill Invocation

Skills live in `.claude/skills/*/SKILL.md`. Invoke inline — no subagent spawn needed.
Skills run in the caller's context and use the caller's model.

## Memory Protocol

See `.claude/rules/memory-management.md` and `.claude/rules/feedback-loop.md` for:
- When to save feedback memories (QG failures, pipeline blockers, user corrections)
- When to inject `[LEARNED PATTERNS]` into agent dispatches
- Memory-check protocol at pipeline completion

## Protocol

**Input:** Missing/ambiguous -> **STOP and ASK**

**Output:** Explicit actions, flagged assumptions, no vague statements

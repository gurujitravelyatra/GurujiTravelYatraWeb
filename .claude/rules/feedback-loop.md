# Automatic Feedback Loop

The agent system learns from its own mistakes. This rule defines when and how to automatically save feedback memories from pipeline execution.

## 1. Quality Gate Failure -> Memory

When the QUALITY GATE finds CRITICAL or HIGH issues, **automatically save a feedback memory** before asking the user to fix.

### What to save

File: `memory/feedback_qg_<category>.md` (one file per recurring pattern category, not per occurrence)

Categories: `missing-null-checks`, `hardcoded-strings`, `missing-translations`, `security-vulnerabilities`, `type-safety`, `api-contract-drift`, `design-guideline-violations`, `test-coverage-gaps`, or a new descriptive category.

### Format

```markdown
---
name: QG pattern — <category>
description: Recurring QG finding: <one-line summary>. Inject into agent prompts to prevent.
type: feedback
---

Pattern: <what the QG keeps finding>
Occurrences: <N> (increment each time)
Last seen: <date>
Affected agents: <which agents produce this error>
Pipeline: <which pipeline>

Examples:
- <file>: <specific finding from most recent occurrence>
- <file>: <specific finding from previous occurrence>

**Why:** QG caught this <N> times. Agents should prevent it, not QG.
**How to apply:** When dispatching <agent>, include in context: "Avoid <pattern>. See QG feedback: <specific guidance>."
```

### When to update vs create

- If `feedback_qg_<category>.md` exists -> increment `Occurrences`, update `Last seen`, add latest example (keep max 3 examples, remove oldest)
- If no matching category -> create new file + add to MEMORY.md

## 2. Pipeline Blocker -> Memory

When a pipeline step produces `Blocker: YES` or fails, save a memory if the failure reveals a **systemic issue** (not a one-off).

### Systemic signals
- Same agent failed on a similar task before (check memory)
- The failure is about a pattern, not a specific bug (e.g., "the frontend agent always forgets a project-specific pattern")
- The fix requires a rule change, not just a code fix

File: `memory/feedback_pipeline_<agent-name>.md`

```markdown
---
name: Pipeline learning — <agent-name>
description: Known failure pattern for <agent>. Include in dispatch context.
type: feedback
---

Agent: <name>
Pattern: <what it keeps getting wrong>
Occurrences: <N>
Last seen: <date>

Fix guidance: <what the agent should do differently>

**Why:** This agent made this mistake <N> times across different features.
**How to apply:** Include in [ORCHESTRATOR CONTEXT] when dispatching this agent.
```

## 3. Orchestrator Injects Feedback Into Dispatches

**Before dispatching any agent as a subagent**, the orchestrator MUST:

1. Check memory for `feedback_qg_*` and `feedback_pipeline_*` files
2. Filter to memories that mention the agent being dispatched
3. If matches found, append a `[LEARNED PATTERNS]` block to the agent's `[ORCHESTRATOR CONTEXT]`:

```
[LEARNED PATTERNS]
The following patterns have been flagged in previous runs. Avoid them:
- <pattern 1>: <guidance> (seen <N> times)
- <pattern 2>: <guidance> (seen <N> times)
```

Keep the block under 10 lines. Only include patterns with Occurrences >= 2 (single occurrences might be one-offs).

## 4. Pattern Decay

Patterns that haven't been seen in 30 days are likely fixed. Mark them as `[RESOLVED]` in the memory file but don't delete — they serve as documentation.

Patterns with Occurrences >= 5 that keep recurring despite injection should be escalated:
- Consider adding the rule to the agent's own `.md` file (permanent fix)
- Or adding it to a `_base*.md` file if it affects multiple agents

## 5. Self-Improvement Cycle

```
Run 1:  Frontend agent forgets a project-specific pattern -> QG catches -> memory saved (occurrences: 1)
Run 2:  Frontend agent dispatched with [LEARNED PATTERNS] -> still forgets -> memory updated (occurrences: 2)
Run 3:  Frontend agent dispatched with stronger guidance -> succeeds -> pattern doesn't recur
Run 5+: If pattern hasn't recurred for 30 days -> mark [RESOLVED]

If pattern hits 5 occurrences despite injection:
-> Escalate: add rule permanently to frontend.md
```

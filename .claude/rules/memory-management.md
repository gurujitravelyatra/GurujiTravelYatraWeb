# Memory Management Rules

Memory lives in the project memory directory. MEMORY.md is the index (loaded every session).

## When to Save

### Pipeline Auto-Learning Triggers (highest priority — see `.claude/rules/feedback-loop.md`)

**Save `feedback_qg_<category>` when:**
- Quality Gate finds CRITICAL or HIGH issues -> categorize and save/update
- This is MANDATORY — never skip, even in AUTO mode

**Save `feedback_pipeline_<agent>` when:**
- An agent produces `Blocker: YES` due to a systemic pattern (not a one-off)
- Same agent fails on similar tasks across multiple runs

**Inject `[LEARNED PATTERNS]` when:**
- Before dispatching any subagent, check memory for matching `feedback_qg_*` and `feedback_pipeline_*` patterns with `Occurrences >= 2`

### Manual Triggers (do these without being asked)

**Save a `feedback_*` memory when:**
- User corrects your approach ("no", "don't", "stop doing X")
- User confirms a non-obvious choice ("yes exactly", "perfect", accepting unusual approach)
- User expresses a preference about how to work
- A pattern is established that should persist (e.g., "always run tests before pushing")

**Save a `project_*` memory when:**
- User mentions a deadline, sprint goal, or initiative
- A significant architectural decision is made
- Work starts on a multi-session feature
- Convert relative dates to absolute (e.g., "next Thursday" -> "2026-04-17")

**Save a `reference_*` memory when:**
- User mentions an external resource (URL, tool, dashboard, channel)
- A new project, area path, or design file is introduced

**Update `user_profile.md` when:**
- New information about the user's role, expertise, or team

### Never Save
- Code patterns (derivable from code)
- Git history (use `git log`)
- Anything already in `.claude/rules/`, `.claude/agents/`, or `CLAUDE.md`
- Ephemeral task details (use TodoWrite instead)
- Debugging solutions (the fix is in the code)

## How to Save

1. Write the memory file with frontmatter (name, description, type)
2. Include **Why** and **How to apply** lines for feedback/project types
3. Update MEMORY.md index (one line per entry, under 150 chars)
4. Check for existing memory to update before creating a new one

## Token Budget

- MEMORY.md index: keep under 200 lines
- Individual files: keep under 500 tokens each
- Total memories: target 8-15 files
- If over 15 files: consolidate or remove stale project memories

## Before Acting on Memory

- If memory names a file path: verify it still exists
- If memory names a function/flag: grep for it
- If memory summarizes repo state: prefer `git log` for current state
- Stale memory? Update or remove it.

## Automatic Memory Check

### In pipelines (handled by ORCHESTRATOR)
Every pipeline ends with a mandatory `MEMORY-CHECK` step — the orchestrator handles this automatically. No action needed from the user.

### Outside pipelines (direct work, no orchestrator)
When you detect any of these signals, run a silent memory check:
- User says "done", "thanks", "that's it", "goodbye", or similar closing phrase
- A significant task just completed (feature implemented, bug fixed, refactor done)
- User corrected your approach (save immediately, don't wait for session end)
- A major decision was made (save immediately)

**How:** Silently check the 5-point list below. Only output `MEMORY-CHECK: <N> updated` if something was saved. If nothing to save, say nothing.

1. Did the user correct any approach? -> save `feedback_*` memory
2. Did a significant decision get made? -> save `project_*` memory
3. Did the user mention new external resources? -> save `reference_*` memory
4. Did QG or review find recurring issues? -> save `feedback_qg_*` memory
5. Are any existing memories now stale? -> update or remove

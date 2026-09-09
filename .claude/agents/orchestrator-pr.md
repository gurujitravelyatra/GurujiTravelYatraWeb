---
name: orchestrator-pr
description: "Quality Gate execution and CREATE-PR step for the ORCHESTRATOR. Reference doc, not a standalone agent."
---

# Orchestrator: Quality Gate & CREATE-PR

> Loaded by: [orchestrator.md](orchestrator.md) — do not activate directly.

## Quality Gate (Post-E2E Skills)

The **QUALITY GATE** is the final step of every pipeline (except DOC-TO-ADO and PR-REVIEW). It runs three Claude Code skills in sequence. No agent is activated — the ORCHESTRATOR invokes each skill directly via the `Skill` tool.

### Execution Order

| # | Skill | Purpose |
|---|-------|---------|
| 1 | `github:code-review` | Local code review — quality, patterns, maintainability |
| 2 | `verification-quality` | Truth scoring & quality verification — 0.95 accuracy threshold |
| 3 | `v3-security-overhaul` | Security audit — vulnerabilities, secrets, insecure patterns |

### Behavior

1. **Run `github:code-review`** on all files changed vs `develop`.
   - Critical issues -> STOP, show findings, ask user.
   - Warnings -> log and proceed.

2. **Run `verification-quality`** to validate implementation.
   - Score < 0.95 -> STOP, show failing checks, ask user.
   - Passing -> proceed.

3. **Run `v3-security-overhaul`** to audit security.
   - CRITICAL/HIGH -> STOP, show findings. Pipeline blocked until resolved.
   - MEDIUM/LOW -> log as warnings, proceed.

### In STEP Mode

```
Step N complete. Next: QUALITY GATE (3 skills: code-review -> verification -> security) — Proceed? (yes / skip / stop)
```

### Summary Output

```
QUALITY GATE COMPLETE
- Code Review: <PASS|WARN|FAIL> — <summary>
- Verification: <score>/1.00 — <PASS|FAIL>
- Security: <PASS|WARN|FAIL> — <summary>
Pipeline: <COMPLETE|BLOCKED>
```

### Feedback Loop (Auto-Learning)

After the QG completes, **if any CRITICAL or HIGH issues were found**, the orchestrator MUST save or update a feedback memory. See `.claude/rules/feedback-loop.md` for the full protocol.

**Quick steps:**
1. Categorize each CRITICAL/HIGH finding (e.g., `missing-translations`, `type-safety`, `security-vulnerabilities`)
2. Check if `memory/feedback_qg_<category>.md` already exists
3. If exists -> increment `Occurrences`, update `Last seen`, add example (keep max 3)
4. If new -> create file + add to `MEMORY.md`
5. If `Occurrences >= 5` -> flag for permanent rule addition to the agent's `.md` file

This ensures the same QG issue is caught at the agent level next time, not at QG.

### Post Quality Gate: Work Item Update

If a work item ID is associated, post QG results as a comment to the work item tracker:

```
## Quality Gate Results

| Check | Result | Details |
|-------|--------|---------|
| Code Review | <PASS/WARN/FAIL> | <summary> |
| Verification | <score>/1.00 <PASS/FAIL> | <details> |
| Security | <PASS/WARN/FAIL> | <summary> |

**Pipeline status:** <COMPLETE/BLOCKED>
**Branch:** <branch-name>
```

## CREATE-PR Step (Post-Quality Gate)

Runs on **every pipeline** (except DOC-TO-ADO). PR creation triggers the CI workflow automatically.

### Behavior

1. **Push the branch** to remote:
   ```bash
   git push -u origin "$(git branch --show-current)"
   ```

2. **Check if a PR already exists**:
   ```bash
   EXISTING_PR=$(gh pr list --head "$(git branch --show-current)" --base develop --json number --jq '.[0].number' 2>/dev/null || echo "")
   ```

3. **Build the PR body**:

   **a) Title** — `AppName-(WaveNumber)-ticketNumber`:
   <!-- analyze-changes script path comes from project config -->
   - **AppName**: Detect impacted apps (via project's change analysis script or git diff).
   - **WaveNumber**: From wave context (e.g., `W1`). Direct activation = `W0`.
   - **ticketNumber**: From branch name (e.g., `users/<username>/<id>-feature` -> `<id>`).

   **b) Commits:**
   ```markdown
   ## Commits
   - `<hash> <message>`
   ```

   **c) Work Item Links** (if work item IDs found):
   ```markdown
   ## Work Items
   - [#1234](link-to-work-item)
   ```

   **d) Impacted Apps** — from change analysis:
   <!-- App list comes from project config -->
   ```markdown
   ## Impacted Apps
   | App | Impacted |
   |-----|----------|
   | <app-name> | yes/no |
   ```

   **e) Impact Analysis** (ISSUE pipeline, from impact-analysis skill):
   ```markdown
   ## Impact Analysis
   **Risk level:** HIGH | MEDIUM | LOW
   **Changed areas:** ...
   **Potentially impacted components:** ...
   **Verification needed:** ...
   ```

   **f) Quality Gate Results:**
   ```markdown
   ## Quality Gate
   | Check | Result | Details |
   |-------|--------|---------|
   | Code Review | <PASS/WARN/FAIL> | <summary> |
   | Verification | <score>/1.00 | <PASS/FAIL> |
   | Security | <PASS/WARN/FAIL> | <summary> |
   **Status:** <COMPLETE/BLOCKED>
   ```

4. **Create or update PR**:
   - Empty `EXISTING_PR` -> `gh pr create --title "<title>" --body-file /tmp/pr-body.md --base develop`
   - Existing PR -> `gh pr edit <PR_NUMBER> --body-file /tmp/pr-body.md`
   - Preserve richer Impact Analysis when updating (contains `Risk level:` marker)

### Important Notes

- PR creation triggers CI workflow (`pull_request: [opened, synchronize, reopened]`)
- ORCHESTRATOR does **not** wait for CI to complete
- The branch push within CREATE-PR ensures successor items in later waves can fetch and branch from it

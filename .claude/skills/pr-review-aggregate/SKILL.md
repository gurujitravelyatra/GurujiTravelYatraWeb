---
name: pr-review-aggregate
description: "Aggregate parallel PR review results (code review, SonarCloud, verification, security) into a structured PR comment with change requests. Use at the end of the PR-REVIEW pipeline."
---

# PR Review Aggregator

Collects parallel review results, deduplicates, classifies, and posts structured comment on the PR. Runs inline.

## When to Use
- PR-REVIEW pipeline (after parallel review skills complete)
- Standalone: `/pr-review-aggregate <PR_NUMBER>`

## Required Input
- PR number
- Review results from parallel skills (in current context)

## Workflow

### 1. Fetch PR Context
```bash
gh pr view <PR_NUMBER> --json title,body,headRefName,baseRefName,files,additions,deletions
```

### 2. Receive Parallel Review Results
From current context (passed by ORCHESTRATOR or available from prior skill runs):
- `github:code-review` — code quality, patterns, maintainability
- `sonarcloud:analyze-and-fix` — SonarCloud issues
- `verification-quality` — truth scoring
- `v3-security-overhaul` — security audit

### 3. Classify Findings

| Severity | Action |
|----------|--------|
| CRITICAL | **Request Change** — must fix before merge |
| HIGH | **Request Change** — should fix before merge |
| MEDIUM | **Suggestion** — recommended improvement |
| LOW / INFO | **Comment** — informational |

Deduplicate: same file + same line + same issue = single entry.

### 4. Build Review Comment

#### Changes needed:
```markdown
## PR Review — #<PR_NUMBER>

### Change Requests
| # | File | Line | Severity | Source | Issue | What it fixes |
|---|------|------|----------|--------|-------|---------------|

### Suggestions
| # | File | Line | Source | Suggestion | Benefit |
|---|------|------|--------|------------|---------|

### Review Summary
| Source | Critical | High | Medium | Low |
|--------|----------|------|--------|-----|

**Verdict: Changes Requested** — <N> items must be addressed.
```

#### No changes needed:
```markdown
## PR Review — #<PR_NUMBER>
**Review Done** — No changes requested.
All checks passed.
This PR is ready for human review and merge.
```

### 5. Post Comment
```bash
gh pr comment <PR_NUMBER> --body-file /tmp/pr-review-<PR_NUMBER>.md
```

### 6. Submit GitHub Review
- CRITICAL/HIGH findings -> `gh pr review <PR_NUMBER> --request-changes`
- Only MEDIUM/LOW/none -> `gh pr review <PR_NUMBER> --comment`

## Constraints
- Never fix code — only report
- Never approve a PR with CRITICAL findings
- Explain **what the change fixes** (not just what's wrong)
- Deduplicate across sources
- Group findings by file

## Forbidden
- Implementing fixes
- Closing or merging the PR
- Dismissing findings without justification

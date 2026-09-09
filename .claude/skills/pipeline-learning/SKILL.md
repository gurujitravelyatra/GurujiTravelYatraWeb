---
name: pipeline-learning
description: "Review and analyze feedback patterns from pipeline runs. Shows recurring QG failures, agent errors, and learning progress. Use to see what the system has learned and what needs escalation."
---

# Pipeline Learning Review

Analyze the feedback loop — what has the system learned from past pipeline runs?

## When to Use
- After multiple pipeline runs to check learning progress
- When QG keeps finding the same issues
- Monthly review: `/pipeline-learning`

## Workflow

### 1. Scan Feedback Memories

Read all `memory/feedback_qg_*.md` and `memory/feedback_pipeline_*.md` files.

### 2. Build Pattern Report

```
PIPELINE LEARNING REPORT
========================

Active Patterns (injected into agent dispatches):
| Category | Occurrences | Last Seen | Affected Agents | Status |
|----------|-------------|-----------|-----------------|--------|
| missing-translations | 4 | 2026-04-10 | frontend | Active |
| type-safety | 2 | 2026-04-08 | backend, frontend | Active |

Resolved Patterns (not seen in 30+ days):
| Category | Total Occurrences | Last Seen | Resolution |
|----------|-------------------|-----------|------------|
| hardcoded-strings | 3 | 2026-03-05 | Rule added to frontend.md |

Escalation Needed (>= 5 occurrences, still recurring):
| Category | Occurrences | Affected Agents | Recommended Action |
|----------|-------------|-----------------|-------------------|
| <none or list> | | | Add rule to agent .md file |

No Feedback Yet:
<list agents that have never triggered a feedback memory>
```

### 3. Escalation Actions

For patterns with `Occurrences >= 5`:
1. Read the feedback memory for the full pattern details
2. Propose a permanent rule to add to the agent's `.md` file
3. If approved, add the rule and mark the memory as `[ESCALATED -> <agent>.md]`

### 4. Decay Check

For patterns not seen in 30+ days:
1. Mark as `[RESOLVED]` in the memory file
2. Keep the file (documentation value) but exclude from dispatch injection

### 5. Summary

```
Learning Health:
- Total patterns tracked: <N>
- Active (injected): <N>
- Resolved: <N>
- Needing escalation: <N>
- Agents with no feedback: <list>
```

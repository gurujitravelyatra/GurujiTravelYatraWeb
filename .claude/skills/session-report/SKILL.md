---
name: session-report
description: "Generate a full session report: agents used, skills invoked, tokens, models, inline vs delegated work, and estimated cost."
---

# Session Report

Generate a comprehensive report of the current Claude Code session.

## When to Use
- End of a session to get a summary
- After a pipeline run to audit resource usage
- On demand: `/session-report`

## Workflow

### 1. Collect Session Metadata

Run the following bash command to get the raw session cost data:

```bash
claude-code --print-cost 2>/dev/null || echo "cost-api-unavailable"
```

If unavailable, note that cost data will be estimated.

### 2. Scan Conversation for Agent Activity

Review the entire conversation history and extract:

**Agents activated** (look for `Agent <NAME> activated` patterns):
- Agent name and number
- When activated (step in pipeline or standalone)
- What it produced (artifact type: spec, code, tests, review, etc.)

**Skills invoked** (look for `Skill` tool calls):
- Skill name
- What it produced

**Sub-agents spawned** (look for `Agent` tool calls with subagent_type):
- Agent type (Explore, Plan, general-purpose, etc.)
- Description / purpose
- Model used (if specified: sonnet, opus, haiku)

### 3. Classify Work: Inline vs Delegated

For each significant action in the session, classify:

| Category | Definition |
|----------|-----------|
| **Inline** | Work done directly in the main conversation thread (edits, reads, bash commands, direct responses) |
| **Delegated** | Work dispatched to a sub-agent via the Agent tool |
| **Skill** | Work done via a Skill invocation |
| **Pipeline agent** | Work done by an activated pipeline agent (ORCHESTRATOR children) |

### 4. Estimate Token Usage and Cost

Use these reference rates for estimation (per 1M tokens):

| Model | Input | Output |
|-------|-------|--------|
| claude-opus-4-6 | $15.00 | $75.00 |
| claude-sonnet-4-6 | $3.00 | $15.00 |
| claude-haiku-4-5 | $0.80 | $4.00 |

Estimation heuristics (when exact counts unavailable):
- Each user message + response turn: ~2K-5K input tokens, ~500-2K output tokens
- Each file read: ~50-200 tokens per KB of file content
- Each sub-agent: ~5K-15K input tokens, ~2K-5K output tokens
- Each skill invocation: ~3K-8K input tokens, ~1K-3K output tokens
- Large planning/analysis responses: ~2K-5K output tokens

Count the actual turns, tool calls, file reads, and agent spawns in the conversation to build the estimate.

### 5. Generate Report

Output the report in this format:

```
SESSION REPORT
==============
Date: <today>
Duration: <first message to now, if inferrable>
Branch: <current git branch>
Model: <primary model used>

AGENTS ACTIVATED
| # | Agent | Pipeline | Artifact | Status |
|---|-------|----------|----------|--------|
| 1 | ORCHESTRATOR | — | Pipeline plan | done |
| 4 | FRONTEND | FEATURE step 3 | Components | done |
| ... | ... | ... | ... | ... |

SKILLS INVOKED
| Skill | Trigger | Output |
|-------|---------|--------|
| brainstorming | IDEATION step 1 | Design spec |
| verification-quality | QG step 1 | Score 0.97 |
| ... | ... | ... |

SUB-AGENTS SPAWNED
| # | Type | Model | Description | Tokens (est.) |
|---|------|-------|-------------|---------------|
| 1 | Explore | sonnet | Find auth middleware | ~8K |
| 2 | general-purpose | opus | Research Graph API | ~12K |
| ... | ... | ... | ... | ... |

WORK DISTRIBUTION
| Category | Actions | Est. Tokens | % of Session |
|----------|---------|-------------|-------------|
| Inline | 23 | ~45K | 38% |
| Delegated (sub-agents) | 5 | ~52K | 44% |
| Skills | 3 | ~15K | 13% |
| Pipeline agents | 2 | ~6K | 5% |

TOKEN SUMMARY
| Metric | Estimate |
|--------|----------|
| Total input tokens | ~85K |
| Total output tokens | ~33K |
| Primary model | claude-opus-4-6 |
| Sub-agent models | sonnet x3, haiku x2 |

COST ESTIMATE
| Model | Input | Output | Subtotal |
|-------|-------|--------|----------|
| opus-4-6 | ~70K ($1.05) | ~28K ($2.10) | $3.15 |
| sonnet-4-6 | ~12K ($0.04) | ~4K ($0.06) | $0.10 |
| haiku-4-5 | ~3K ($0.00) | ~1K ($0.00) | $0.01 |
| **TOTAL** | | | **$3.26** |

ACTIONS DETAIL
| # | Type | Action | Model | Inline/Delegated |
|---|------|--------|-------|-----------------|
| 1 | Read | CLAUDE.md | opus | Inline |
| 2 | Agent | Explore codebase | sonnet | Delegated |
| 3 | Edit | orchestrator.md | opus | Inline |
| 4 | Skill | brainstorming | opus | Skill |
| ... | ... | ... | ... | ... |
```

### 6. Notes

- Token counts are **estimates** unless exact data is available from the CLI
- Cost is based on public Anthropic API pricing — actual Claude Code pricing may differ
- Sub-agent token counts include their full context (system prompt + conversation + tools)
- If the session used `/fast` mode, note it but the model is still opus (just faster output)
- Cached input tokens are billed at 90% discount — estimates assume no caching (worst case)

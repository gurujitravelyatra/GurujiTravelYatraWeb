# Multi-Agent System

This repository uses a modular multi-agent workflow built on Claude Code's native agent system.

## Quick Start

**Multi-step task:** `Activate ORCHESTRATOR` (with Task, Mode, optional Scope)

**Single agent:** `Activate <AGENT_NAME>`

**Agent confirms:** `Agent <AGENT_NAME> activated.`

## Structure

| Location | Purpose | Auto-loaded? |
|----------|---------|-------------|
| `.claude/rules/agent-manual.md` | Agent manual (index, pipelines, model routing) | **Yes** (every session) |
| `.claude/agents/*.md` | Agent definitions (YAML frontmatter) | **Yes** (agent registry) |
| `.claude/agents/_base-core.md` | Framework rules (tools, protocol, compression) | On activation |
| `.claude/agents/_base-project.md` | Project rules (stack, architecture, routing) | On activation |
| `.claude/agents/_base-*.md` | Role-specific rules (impl, test, spec, design) | On activation |
| `.claude/skills/*/SKILL.md` | Reusable skills ( active) | On invocation |
| `documentation//` | Architecture docs, specs, guidelines (reference) | On demand |
| `.claude/templates/figma-designers.md` | **Designer onboarding guide** — Figma setup, daily commands, troubleshooting | On demand |
| `.claude/rules/figma-workflow.md` | Designer routing rules — auto-loaded every session | **Yes** |

## Core Rules

1. **Manual workflow** - NOT autonomous, obey activated agent only
2. **No implicit switching** - Explicit activation required
3. **Spec-driven** - Features require Technical Specifications
4. **Stop conditions** - Missing/ambiguous input → STOP and ASK
5. **Orchestrated or direct** - Use ORCHESTRATOR for pipelines, or activate agents directly

## Agent Loading

When activated, load:
1. `.claude/agents/_base-core.md` (framework rules)
2. `.claude/agents/_base-project.md` (project rules + model routing)
3. `.claude/agents/<agent>.md` (specific agent with YAML frontmatter)
4. Role-specific base if declared in frontmatter (`inherits: [_base-impl]`)

